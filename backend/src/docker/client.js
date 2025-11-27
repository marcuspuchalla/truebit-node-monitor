import Docker from 'dockerode';
import { EventEmitter } from 'events';

class DockerClient extends EventEmitter {
  constructor(containerName, socketPath = '/var/run/docker.sock') {
    super();
    this.containerName = containerName;
    this.docker = new Docker({ socketPath });
    this.container = null;
    this.logStream = null;
  }

  /**
   * Initialize and verify container exists (READ-ONLY operation)
   */
  async initialize() {
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
      console.error('Failed to initialize Docker client:', error.message);
      throw error;
    }
  }

  /**
   * Get container info (READ-ONLY)
   */
  async getContainerInfo() {
    if (!this.container) {
      await this.initialize();
    }

    try {
      const info = await this.container.inspect();
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
      console.error('Failed to get container info:', error.message);
      throw error;
    }
  }

  /**
   * Get container stats (READ-ONLY)
   */
  async getContainerStats() {
    if (!this.container) {
      await this.initialize();
    }

    try {
      const stats = await this.container.stats({ stream: false });

      // Calculate CPU percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuPercent = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

      // Calculate memory usage
      const memoryUsage = stats.memory_stats.usage;
      const memoryLimit = stats.memory_stats.limit;
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
      console.error('Failed to get container stats:', error.message);
      return null;
    }
  }

  /**
   * Stream logs from container (READ-ONLY, non-disruptive)
   * @param {Object} options - Log options
   * @param {boolean} options.follow - Follow log output
   * @param {boolean} options.timestamps - Include timestamps
   * @param {number} options.tail - Number of lines to show from end
   */
  async streamLogs(options = {}) {
    if (!this.container) {
      await this.initialize();
    }

    const defaultOptions = {
      follow: options.follow !== undefined ? options.follow : true,
      stdout: true,
      stderr: true,
      timestamps: options.timestamps !== undefined ? options.timestamps : true,
      tail: options.tail || 100
    };

    try {
      this.logStream = await this.container.logs(defaultOptions);

      // Emit log data
      this.logStream.on('data', (chunk) => {
        // Docker prepends 8 bytes of header to each message
        // Format: [STREAM_TYPE, 0, 0, 0, SIZE1, SIZE2, SIZE3, SIZE4, ...DATA]
        const data = chunk.toString('utf8');
        this.emit('log', data);
      });

      this.logStream.on('end', () => {
        this.emit('log-end');
        console.log('Log stream ended');
      });

      this.logStream.on('error', (error) => {
        this.emit('log-error', error);
        console.error('Log stream error:', error.message);
      });

      return this.logStream;
    } catch (error) {
      console.error('Failed to stream logs:', error.message);
      throw error;
    }
  }

  /**
   * Get historical logs (READ-ONLY)
   */
  async getHistoricalLogs(tail = 'all') {
    if (!this.container) {
      await this.initialize();
    }

    try {
      const logOptions = {
        follow: false,
        stdout: true,
        stderr: true,
        timestamps: true
      };

      // If tail is not 'all', add tail parameter
      if (tail !== 'all') {
        logOptions.tail = tail;
      }

      const logBuffer = await this.container.logs(logOptions);

      // Docker returns a Buffer, convert to string
      if (Buffer.isBuffer(logBuffer)) {
        return logBuffer.toString('utf8');
      }

      // If it's a stream (older Docker API versions)
      if (logBuffer && typeof logBuffer.on === 'function') {
        return new Promise((resolve, reject) => {
          let logs = '';

          logBuffer.on('data', (chunk) => {
            logs += chunk.toString('utf8');
          });

          logBuffer.on('end', () => {
            resolve(logs);
          });

          logBuffer.on('error', reject);
        });
      }

      // Fallback
      return logBuffer.toString('utf8');
    } catch (error) {
      console.error('Failed to get historical logs:', error.message);
      throw error;
    }
  }

  /**
   * Stop log streaming (does NOT stop container)
   */
  stopLogStream() {
    if (this.logStream) {
      this.logStream.destroy();
      this.logStream = null;
      console.log('Log stream stopped');
    }
  }

  /**
   * Check if Docker daemon is accessible
   */
  async ping() {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      console.error('Docker daemon not accessible:', error.message);
      return false;
    }
  }
}

export default DockerClient;
