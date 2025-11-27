/**
 * Parser for TrueBit worker logs
 * Extracts structured data from log lines
 */

class LogParser {
  constructor() {
    // Regex patterns for different log types
    this.patterns = {
      // Standard log line (after ANSI codes removed): 2025-11-24 13:55:34 info: @truebit/worker-runner-node-0x558f...
      logLine: /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (info|warn|error): @truebit\/worker-runner-node(?:-([0-9A-Fa-fx]+))?:([0-9.-]+(?:-beta\.\d+)?)\s+(.+)$/,

      // Task received
      taskReceived: /Message received from task_created:/,

      // Execution ID
      executionId: /executionId['":\s]+([a-f0-9-]+)/i,

      // Task completion
      taskCompleted: /Execution ([a-f0-9-]+) completed/,

      // Semaphore slot usage
      semaphoreSlot: /Using slot (\d+)\/(\d+)/,
      semaphoreRelease: /Released slot \((\d+)\/(\d+) now active\)/,

      // Invoice events
      invoiceEvent: /InvoiceSubscriber/,

      // Node registration
      nodeRegistration: /Node with address (0x[0-9A-Fa-f]+) (?:registered successfully|requested registration)/,

      // JSON payload (for task data, execution results, etc.)
      jsonPayload: /({[\s\S]*})\s*$/
    };
  }

  /**
   * Aggregate multi-line log entries
   * Lines without timestamps are continuations of the previous entry
   */
  aggregateLines(lines) {
    const aggregated = [];
    let currentEntry = null;

    for (const line of lines) {
      if (!line || !line.trim()) continue;

      // Simpler check: does line start with a timestamp?
      // Format: YYYY-MM-DD HH:MM:SS
      const hasTimestamp = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(line);

      if (hasTimestamp) {
        // Save previous entry if exists
        if (currentEntry) {
          aggregated.push(currentEntry);
        }
        // Start new entry with original line (preserve formatting)
        currentEntry = line;
      } else if (currentEntry) {
        // Continuation line - append to current entry
        currentEntry += '\n' + line;
      }
    }

    // Add last entry
    if (currentEntry) {
      aggregated.push(currentEntry);
    }

    return aggregated;
  }

  /**
   * Parse a raw log line into structured data
   */
  parseLine(line) {
    // Remove ANSI color codes and Docker container prefix
    const cleanLine = line
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI codes
      .replace(/^runner-node\s+\|\s+/, ''); // Remove "runner-node | " prefix

    if (!cleanLine.trim()) {
      return null;
    }

    // Only match first line if multiline (aggregated logs may have \n)
    const lines = cleanLine.split('\n');
    const firstLine = lines[0];
    const match = firstLine.match(this.patterns.logLine);

    if (!match) {
      // Not a standard log line, might be continuation of JSON
      return this.parseRawLine(cleanLine);
    }

    const [, timestamp, level, address, version, message] = match;

    // For multi-line logs, combine first line message with continuation lines
    let fullMessage = message.trim();
    if (lines.length > 1) {
      // Add continuation lines
      const continuationLines = lines.slice(1).join('\n');
      fullMessage = fullMessage + '\n' + continuationLines;
    }

    const parsed = {
      timestamp: new Date(timestamp),
      timestampOriginal: timestamp, // Keep original timestamp string
      level,
      address: address || null,
      version: version || null,
      message: fullMessage,
      type: this.detectLogType(message),
      raw: cleanLine
    };

    // Extract additional data based on type
    if (parsed.type === 'task_received' || parsed.type === 'task_completed') {
      parsed.executionId = this.extractExecutionId(message);
      parsed.data = this.extractJSON(message);
    } else if (parsed.type === 'semaphore') {
      parsed.semaphore = this.extractSemaphoreInfo(message);
    } else if (parsed.type === 'invoice') {
      parsed.data = this.extractJSON(message);
    } else if (parsed.type === 'registration') {
      // SECURITY: Do NOT extract wallet address for privacy protection
      // Wallet addresses must never be stored or transmitted in federation
      // parsed.nodeAddress = '[REDACTED FOR PRIVACY]';
    }

    return parsed;
  }

  /**
   * Parse raw line (non-standard format, usually JSON continuation)
   */
  parseRawLine(line) {
    // Check if it's a JSON line
    const trimmed = line.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const json = JSON.parse(trimmed);
        return {
          type: 'json_data',
          data: json,
          raw: line
        };
      } catch (e) {
        // Not valid JSON, treat as raw
      }
    }

    // Check for execution output
    if (line.includes('Command execution stdout:') || line.includes('Command execution stderr:')) {
      return {
        type: 'execution_output',
        raw: line,
        data: this.extractJSON(line)
      };
    }

    return {
      type: 'raw',
      raw: line
    };
  }

  /**
   * Detect the type of log entry
   */
  detectLogType(message) {
    if (this.patterns.taskReceived.test(message)) {
      return 'task_received';
    } else if (this.patterns.taskCompleted.test(message)) {
      return 'task_completed';
    } else if (this.patterns.invoiceEvent.test(message)) {
      return 'invoice';
    } else if (this.patterns.semaphoreSlot.test(message) || this.patterns.semaphoreRelease.test(message)) {
      return 'semaphore';
    } else if (this.patterns.nodeRegistration.test(message)) {
      return 'registration';
    } else if (message.includes('Task') && message.includes('downloaded successfully')) {
      return 'task_download';
    } else if (message.includes('Starting task execution')) {
      return 'task_start';
    } else if (message.includes('Message published to compute_outcome')) {
      return 'task_published';
    }

    return 'info';
  }

  /**
   * Extract execution ID from message
   */
  extractExecutionId(message) {
    const match = message.match(this.patterns.executionId);
    return match ? match[1] : null;
  }

  /**
   * Extract JSON payload from message
   */
  extractJSON(message) {
    const match = message.match(this.patterns.jsonPayload);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  /**
   * Extract semaphore slot information
   */
  extractSemaphoreInfo(message) {
    let match = message.match(this.patterns.semaphoreSlot);
    if (match) {
      return {
        action: 'acquire',
        current: parseInt(match[1]),
        total: parseInt(match[2])
      };
    }

    match = message.match(this.patterns.semaphoreRelease);
    if (match) {
      return {
        action: 'release',
        current: parseInt(match[1]),
        total: parseInt(match[2])
      };
    }

    return null;
  }

  /**
   * Parse execution metrics from stdout JSON
   */
  parseExecutionMetrics(stdout) {
    try {
      const metrics = typeof stdout === 'string' ? JSON.parse(stdout) : stdout;

      return {
        elapsed: parseInt(metrics.elapsed) / 1000000, // Convert to ms
        exitCode: metrics.wasi?.exitCode,
        gas: {
          limit: metrics.metering?.limits?.gas,
          used: metrics.metering?.last?.steps
        },
        memory: {
          limit: metrics.metering?.limits?.memory,
          peak: metrics.metering?.peak?.memory
        },
        call: {
          limit: metrics.metering?.limits?.call,
          peak: metrics.metering?.peak?.call
        },
        frame: {
          limit: metrics.metering?.limits?.frame,
          peak: metrics.metering?.peak?.frame
        },
        wasm: {
          size: metrics.execution?.wasm?.size,
          hash: metrics.execution?.wasm?.hash
        },
        cached: metrics.execution?.prepare?.cached || false
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Parse task input data
   */
  parseTaskInput(input) {
    try {
      const data = typeof input === 'string' ? JSON.parse(input) : input;
      return {
        Input: data.Input,
        source: data.source,
        taskType: this.detectTaskType(data)
      };
    } catch (e) {
      return { raw: input };
    }
  }

  /**
   * Detect task type from input
   */
  detectTaskType(data) {
    if (data.source) {
      if (data.source.includes('function')) return 'javascript';
      if (data.source.includes('def ')) return 'python';
    }
    return 'unknown';
  }

  /**
   * Parse multiple log lines into structured events
   */
  parseLogStream(logText) {
    const lines = logText.split('\n');
    const events = [];
    let currentTask = null;

    for (const line of lines) {
      const parsed = this.parseLine(line);

      if (!parsed) continue;

      // Group task-related logs together
      if (parsed.type === 'task_received') {
        currentTask = {
          executionId: parsed.executionId,
          receivedAt: parsed.timestamp,
          logs: [parsed],
          status: 'received'
        };
        events.push(currentTask);
      } else if (parsed.type === 'task_completed' && currentTask) {
        currentTask.completedAt = parsed.timestamp;
        currentTask.status = 'completed';
        currentTask.logs.push(parsed);
      } else if (parsed.type === 'execution_output' && currentTask) {
        currentTask.metrics = this.parseExecutionMetrics(parsed.data);
        currentTask.logs.push(parsed);
      } else {
        events.push(parsed);
      }
    }

    return events;
  }
}

export default LogParser;
