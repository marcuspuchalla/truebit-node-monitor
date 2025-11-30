import Docker from 'dockerode';
import { EventEmitter } from 'events';
import type { Readable } from 'stream';

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

  constructor(containerName: string, socketPath: string = '/var/run/docker.sock') {
    super();
    this.containerName = containerName;
    this.docker = new Docker({ socketPath });
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

      // Emit log data
      this.logStream.on('data', (chunk: Buffer) => {
        // Docker prepends 8 bytes of header to each message
        // Format: [STREAM_TYPE, 0, 0, 0, SIZE1, SIZE2, SIZE3, SIZE4, ...DATA]
        const data = chunk.toString('utf8');
        this.emit('log', data);
      });

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
      console.log('Log stream stopped');
    }
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
