import { EventEmitter } from 'events';

/**
 * Reader for TrueBit's log files inside the container
 * Supports both current (.log) and historical (.log.gz) files
 */
class LogFileReader extends EventEmitter {
  constructor(container) {
    super();
    this.container = container;
    this.logBasePath = '/app/logs/@truebit';
    this.tailStream = null;
  }

  /**
   * Execute command in container and return output
   */
  async execCommand(cmd) {
    const exec = await this.container.exec({
      Cmd: ['sh', '-c', cmd],
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start({ hijack: false, stdin: false });

    return new Promise((resolve, reject) => {
      let output = '';
      stream.on('data', (chunk) => {
        // Remove Docker stream header (8 bytes)
        const str = chunk.toString('utf8');
        output += str.length > 8 ? str.substring(8) : str;
      });
      stream.on('end', () => resolve(output));
      stream.on('error', reject);
    });
  }

  /**
   * Find the correct log directory path
   */
  async findLogDirectory() {
    try {
      // List directories in /app/logs/@truebit/
      const dirs = await this.execCommand(`ls -1 ${this.logBasePath}`);
      const dirList = dirs.split('\n').filter(d => d.trim() && d.startsWith('worker-runner-node'));

      if (dirList.length === 0) {
        throw new Error('No worker log directory found');
      }

      // Use the one with address in the name (more specific)
      const workerDir = dirList.find(d => d.includes('0x')) || dirList[0];
      return `${this.logBasePath}/${workerDir}/debug`;
    } catch (error) {
      console.error('Failed to find log directory:', error.message);
      throw error;
    }
  }

  /**
   * List all log files in the directory
   */
  async listLogFiles() {
    try {
      const logDir = await this.findLogDirectory();
      const filesOutput = await this.execCommand(`ls -1 ${logDir}`);
      const files = filesOutput.split('\n').filter(f => f.endsWith('.log') || f.endsWith('.log.gz'));

      return files.map(file => ({
        name: file,
        path: `${logDir}/${file}`,
        compressed: file.endsWith('.gz'),
        date: file.match(/\d{4}-\d{2}-\d{2}/)?.[0]
      }));
    } catch (error) {
      console.error('Failed to list log files:', error.message);
      return [];
    }
  }

  /**
   * Read a log file (handles both .log and .log.gz)
   */
  async readLogFile(filePath, compressed = false) {
    try {
      const command = compressed ? `zcat ${filePath}` : `cat ${filePath}`;
      const content = await this.execCommand(command);
      return content;
    } catch (error) {
      console.error(`Failed to read log file ${filePath}:`, error.message);
      return '';
    }
  }

  /**
   * Read all historical log files
   */
  async readHistoricalLogs() {
    const files = await this.listLogFiles();
    const historicalFiles = files.filter(f => f.compressed);

    console.log(`   Found ${historicalFiles.length} historical log files`);

    let allLogs = '';
    let totalLines = 0;

    for (const file of historicalFiles.sort((a, b) => a.date?.localeCompare(b.date))) {
      console.log(`   Reading ${file.name}...`);
      const content = await this.readLogFile(file.path, true);
      const lineCount = content.split('\n').filter(l => l.trim()).length;
      totalLines += lineCount;
      allLogs += content + '\n';
      console.log(`      → ${lineCount} lines`);
    }

    console.log(`   Total historical lines: ${totalLines}`);
    return allLogs;
  }

  /**
   * Get current day's log file path
   */
  async getCurrentLogFile() {
    const files = await this.listLogFiles();
    const currentFile = files.find(f => !f.compressed);
    return currentFile?.path;
  }

  /**
   * Tail the current log file for real-time updates
   */
  async tailCurrentLog() {
    const logFile = await this.getCurrentLogFile();

    if (!logFile) {
      console.error('No current log file found to tail');
      return;
    }

    console.log(`   Tailing current log: ${logFile}`);

    try {
      // Use exec with tail -f
      const exec = await this.container.exec({
        Cmd: ['tail', '-f', '-n', '0', logFile],
        AttachStdout: true,
        AttachStderr: true
      });

      this.tailStream = await exec.start({ hijack: true, stdin: false });

      this.tailStream.on('data', (chunk) => {
        // Process data, removing Docker header
        const str = chunk.toString('utf8');
        const lines = str.split('\n').filter(l => l.trim());
        lines.forEach(line => {
          // Clean line by removing potential stream headers
          const cleanLine = line.length > 8 && line.charCodeAt(0) < 32 ? line.substring(8) : line;
          if (cleanLine.trim()) {
            this.emit('line', cleanLine);
          }
        });
      });

      this.tailStream.on('end', () => {
        console.log('Tail stream ended, attempting to restart...');
        setTimeout(() => this.tailCurrentLog(), 5000);
      });

      this.tailStream.on('error', (error) => {
        console.error('Tail stream error:', error.message);
      });
    } catch (error) {
      console.error('Failed to start tail stream:', error.message);
    }
  }

  /**
   * Stop tailing
   */
  stopTailing() {
    if (this.tailStream) {
      this.tailStream.destroy();
      this.tailStream = null;
      console.log('Stopped tailing log file');
    }
  }

  /**
   * Read current log file (for initial load)
   */
  async readCurrentLog(tailLines = 100) {
    const logFile = await this.getCurrentLogFile();

    if (!logFile) {
      console.log('   No current log file found');
      return '';
    }

    try {
      const content = await this.execCommand(`tail -n ${tailLines} ${logFile}`);
      return content;
    } catch (error) {
      console.error('Failed to read current log:', error.message);
      return '';
    }
  }
}

export default LogFileReader;
