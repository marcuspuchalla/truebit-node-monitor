import Docker from 'dockerode';
import { EventEmitter } from 'events';
import { PassThrough, type Readable } from 'stream';

export interface ContainerInfo {
  id: string;
  name: string;
  state: string;
  running: boolean;
  startedAt: string;
  image: string;
  created: string;
}

export interface ContainerStats {
  cpu: string;
  memory: {
    usage: string;
    limit: string;
    percent: string;
  };
}

class DockerClient extends EventEmitter {
  private containerName: string;
  private docker: Docker;
  public container: Docker.Container | null = null;
  private logStream: Readable | null = null;
  private logStdout: Readable | null = null;
  private logStderr: Readable | null = null;

  constructor(containerName: string, socketPath: string = '/var/run/docker.sock') {
    super();
    this.containerName = containerName;
    this.docker = new Docker({ socketPath });
  }

  /**
   * Execute a command in the container (array-based, no shell)
   */
  private async execCommandArray(cmdArray: string[]): Promise<Buffer> {
    if (!this.container) {
      await this.initialize();
    }

    const exec = await this.container!.exec({
      Cmd: cmdArray,
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start({ hijack: false, stdin: false }) as unknown as Readable;

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => {
        // Remove Docker stream header (8 bytes) when present
        const data = chunk.length > 8 ? chunk.subarray(8) : chunk;
        chunks.push(data);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Initialize and verify container exists (READ-ONLY operation)
   */
  async initialize(): Promise<boolean> {
    try {
      const containers = await this.docker.listContainers({ all: true });
      const targetContainer = containers.find(c =>
        c.Names.some(name => name.includes(this.containerName))
      );

      if (!targetContainer) {
        throw new Error(`Container "${this.containerName}" not found`);
      }

      this.container = this.docker.getContainer(targetContainer.Id);
      console.log(`✓ Connected to container: ${this.containerName} (${targetContainer.Id.substring(0, 12)})`);

      return true;
    } catch (error) {
      console.error('Failed to initialize Docker client:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Get container info (READ-ONLY)
   */
  async getContainerInfo(): Promise<ContainerInfo> {
    if (!this.container) {
      await this.initialize();
    }

    try {
      const info = await this.container!.inspect();
      return {
        id: info.Id.substring(0, 12),
        name: info.Name.replace(/^\//, ''),
        state: info.State.Status,
        running: info.State.Running,
        startedAt: info.State.StartedAt,
        image: info.Config.Image,
        created: info.Created
      };
    } catch (error) {
      console.error('Failed to get container info:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Get container stats (READ-ONLY)
   */
  async getContainerStats(): Promise<ContainerStats | null> {
    if (!this.container) {
      await this.initialize();
    }

    try {
      const stats = await this.container!.stats({ stream: false }) as Docker.ContainerStats;

      // Calculate CPU percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage! - stats.precpu_stats.system_cpu_usage!;
      const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus! * 100;

      // Calculate memory usage
      const memoryUsage = stats.memory_stats.usage!;
      const memoryLimit = stats.memory_stats.limit!;
      const memoryPercent = (memoryUsage / memoryLimit) * 100;

      return {
        cpu: cpuPercent.toFixed(2),
        memory: {
          usage: (memoryUsage / 1024 / 1024).toFixed(2), // MB
          limit: (memoryLimit / 1024 / 1024).toFixed(2), // MB
          percent: memoryPercent.toFixed(2)
        }
      };
    } catch (error) {
      console.error('Failed to get container stats:', (error as Error).message);
      return null;
    }
  }

  /**
   * Stream logs from container (READ-ONLY, non-disruptive)
   */
  async streamLogs(options: { follow?: boolean; timestamps?: boolean; tail?: number } = {}): Promise<Readable> {
    if (!this.container) {
      await this.initialize();
    }

    const shouldFollow = options.follow !== undefined ? options.follow : true;

    try {
      let logResult: Readable;
      if (shouldFollow) {
        logResult = await this.container!.logs({
          follow: true,
          stdout: true,
          stderr: true,
          timestamps: options.timestamps !== undefined ? options.timestamps : true,
          tail: options.tail || 100
        }) as unknown as Readable;
      } else {
        logResult = await this.container!.logs({
          follow: false,
          stdout: true,
          stderr: true,
          timestamps: options.timestamps !== undefined ? options.timestamps : true,
          tail: options.tail || 100
        }) as unknown as Readable;
      }
      this.logStream = logResult;

      // Demultiplex stdout/stderr (Docker multiplexes streams when TTY is false)
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      this.logStdout = stdout;
      this.logStderr = stderr;
      this.docker.modem.demuxStream(logResult, stdout, stderr);

      const emitChunk = (chunk: Buffer): void => {
        const data = chunk.toString('utf8');
        this.emit('log', data);
      };

      stdout.on('data', emitChunk);
      stderr.on('data', emitChunk);

      this.logStream.on('end', () => {
        this.emit('log-end');
        console.log('Log stream ended');
      });

      this.logStream.on('error', (error: Error) => {
        this.emit('log-error', error);
        console.error('Log stream error:', error.message);
      });

      return this.logStream;
    } catch (error) {
      console.error('Failed to stream logs:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Get historical logs (READ-ONLY)
   */
  async getHistoricalLogs(tail: number | 'all' = 'all'): Promise<string> {
    if (!this.container) {
      await this.initialize();
    }

    try {
      let logBuffer: Buffer;
      if (tail === 'all') {
        logBuffer = await this.container!.logs({
          follow: false,
          stdout: true,
          stderr: true,
          timestamps: true
        });
      } else {
        logBuffer = await this.container!.logs({
          follow: false,
          stdout: true,
          stderr: true,
          timestamps: true,
          tail: tail
        });
      }

      // Docker returns a Buffer, convert to string
      if (Buffer.isBuffer(logBuffer)) {
        return logBuffer.toString('utf8');
      }

      // If it's a stream (older Docker API versions)
      if (logBuffer && typeof (logBuffer as unknown as Readable).on === 'function') {
        return new Promise((resolve, reject) => {
          let logs = '';

          (logBuffer as unknown as Readable).on('data', (chunk: Buffer) => {
            logs += chunk.toString('utf8');
          });

          (logBuffer as unknown as Readable).on('end', () => {
            resolve(logs);
          });

          (logBuffer as unknown as Readable).on('error', reject);
        });
      }

      // Fallback - shouldn't reach here but handle it
      return String(logBuffer);
    } catch (error) {
      console.error('Failed to get historical logs:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Stop log streaming (does NOT stop container)
   */
  stopLogStream(): void {
    if (this.logStream) {
      this.logStream.destroy();
      this.logStream = null;
      this.logStdout?.destroy();
      this.logStderr?.destroy();
      this.logStdout = null;
      this.logStderr = null;
      console.log('Log stream stopped');
    }
  }

  /**
   * Get file size in bytes (returns null if not found)
   */
  async statFileSize(path: string): Promise<number | null> {
    try {
      const result = await this.execCommandArray(['stat', '-c', '%s', path]);
      const size = parseInt(result.toString('utf8').trim(), 10);
      return Number.isFinite(size) ? size : null;
    } catch {
      try {
        const result = await this.execCommandArray(['wc', '-c', path]);
        const size = parseInt(result.toString('utf8').trim().split(/\s+/)[0], 10);
        return Number.isFinite(size) ? size : null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Find prepared wasm artifact by hash in cache
   */
  async findWasmArtifact(hash: string): Promise<{ path: string; sizeBytes: number | null } | null> {
    const base = '/app/build/wasm-files/cache';
    try {
      const versionsBuf = await this.execCommandArray(['ls', '-1', base]);
      const versions = versionsBuf.toString('utf8').split('\n').map(v => v.trim()).filter(Boolean);

      for (const version of versions) {
        const wasmPath = `${base}/${version}/${hash}/prepared.wasm`;
        const size = await this.statFileSize(wasmPath);
        if (size !== null) {
          return { path: wasmPath, sizeBytes: size };
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Read a file from the container (bounded)
   */
  async readFile(path: string, maxBytes: number): Promise<Buffer> {
    return this.execCommandArray(['head', '-c', String(maxBytes), path]);
  }

  /**
   * Check if Docker daemon is accessible
   */
  async ping(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      console.error('Docker daemon not accessible:', (error as Error).message);
      return false;
    }
  }
}

export default DockerClient;
