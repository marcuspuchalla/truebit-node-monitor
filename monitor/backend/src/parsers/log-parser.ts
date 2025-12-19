/**
 * Parser for TrueBit worker logs
 * Extracts structured data from log lines
 */

export interface ParsedLog {
  timestamp?: Date;
  timestampOriginal?: string;
  level?: string;
  address?: string | null;
  version?: string | null;
  message?: string;
  type: string;
  raw: string;
  executionId?: string | null;
  data?: unknown;
  semaphore?: SemaphoreInfo | null;
  nodeAddress?: string;
}

export interface SemaphoreInfo {
  action: 'acquire' | 'release';
  current: number;
  total: number;
}

export interface ExecutionMetrics {
  elapsed: number;
  exitCode?: number;
  gas: {
    limit?: number;
    used?: number;
  };
  memory: {
    limit?: number;
    peak?: number;
  };
  call: {
    limit?: number;
    peak?: number;
  };
  frame: {
    limit?: number;
    peak?: number;
  };
  wasm: {
    size?: number;
    hash?: string;
  };
  cached: boolean;
}

export interface TaskEvent {
  executionId?: string | null;
  receivedAt?: Date;
  completedAt?: Date;
  logs: ParsedLog[];
  status: string;
  metrics?: ExecutionMetrics | null;
}

interface LogPatterns {
  logLine: RegExp;
  taskReceived: RegExp;
  executionId: RegExp;
  taskCompleted: RegExp;
  semaphoreSlot: RegExp;
  semaphoreRelease: RegExp;
  invoiceEvent: RegExp;
  jsonPayload: RegExp;
}

class LogParser {
  private patterns: LogPatterns;

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

      // JSON payload (for task data, execution results, etc.)
      jsonPayload: /({[\s\S]*})\s*$/
    };
  }

  /**
   * Aggregate multi-line log entries
   * Lines without timestamps are continuations of the previous entry
   */
  aggregateLines(lines: string[]): string[] {
    const aggregated: string[] = [];
    let currentEntry: string | null = null;

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
  parseLine(line: string): ParsedLog | null {
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

    const parsed: ParsedLog = {
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
  private parseRawLine(line: string): ParsedLog | null {
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
      } catch {
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
  private detectLogType(message: string): string {
    if (this.patterns.taskReceived.test(message)) {
      return 'task_received';
    } else if (this.patterns.taskCompleted.test(message)) {
      return 'task_completed';
    } else if (this.patterns.invoiceEvent.test(message)) {
      return 'invoice';
    } else if (this.patterns.semaphoreSlot.test(message) || this.patterns.semaphoreRelease.test(message)) {
      return 'semaphore';
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
  private extractExecutionId(message: string): string | null {
    const match = message.match(this.patterns.executionId);
    return match ? match[1] : null;
  }

  /**
   * Extract JSON payload from message
   */
  private extractJSON(message: string): unknown | null {
    const match = message.match(this.patterns.jsonPayload);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Extract semaphore slot information
   */
  private extractSemaphoreInfo(message: string): SemaphoreInfo | null {
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
  parseExecutionMetrics(stdout: unknown): ExecutionMetrics | null {
    try {
      const metrics = typeof stdout === 'string' ? JSON.parse(stdout) : stdout as Record<string, unknown>;

      return {
        elapsed: parseInt(metrics.elapsed as string) / 1000000, // Convert to ms
        exitCode: (metrics.wasi as Record<string, unknown>)?.exitCode as number | undefined,
        gas: {
          limit: ((metrics.metering as Record<string, unknown>)?.limits as Record<string, unknown>)?.gas as number | undefined,
          used: ((metrics.metering as Record<string, unknown>)?.last as Record<string, unknown>)?.steps as number | undefined
        },
        memory: {
          limit: ((metrics.metering as Record<string, unknown>)?.limits as Record<string, unknown>)?.memory as number | undefined,
          peak: ((metrics.metering as Record<string, unknown>)?.peak as Record<string, unknown>)?.memory as number | undefined
        },
        call: {
          limit: ((metrics.metering as Record<string, unknown>)?.limits as Record<string, unknown>)?.call as number | undefined,
          peak: ((metrics.metering as Record<string, unknown>)?.peak as Record<string, unknown>)?.call as number | undefined
        },
        frame: {
          limit: ((metrics.metering as Record<string, unknown>)?.limits as Record<string, unknown>)?.frame as number | undefined,
          peak: ((metrics.metering as Record<string, unknown>)?.peak as Record<string, unknown>)?.frame as number | undefined
        },
        wasm: {
          size: ((metrics.execution as Record<string, unknown>)?.wasm as Record<string, unknown>)?.size as number | undefined,
          hash: ((metrics.execution as Record<string, unknown>)?.wasm as Record<string, unknown>)?.hash as string | undefined
        },
        cached: ((metrics.execution as Record<string, unknown>)?.prepare as Record<string, unknown>)?.cached as boolean || false
      };
    } catch {
      return null;
    }
  }

  /**
   * Parse task input data
   */
  parseTaskInput(input: unknown): { Input?: unknown; source?: string; taskType: string; raw?: unknown } {
    try {
      const data = typeof input === 'string' ? JSON.parse(input) : input as Record<string, unknown>;
      return {
        Input: data.Input,
        source: data.source as string | undefined,
        taskType: this.detectTaskType(data)
      };
    } catch {
      return { raw: input, taskType: 'unknown' };
    }
  }

  /**
   * Detect task type from input
   */
  private detectTaskType(data: Record<string, unknown>): string {
    if (data.source) {
      const source = data.source as string;
      if (source.includes('function')) return 'javascript';
      if (source.includes('def ')) return 'python';
    }
    return 'unknown';
  }

  /**
   * Parse multiple log lines into structured events
   */
  parseLogStream(logText: string): (ParsedLog | TaskEvent)[] {
    const lines = logText.split('\n');
    const events: (ParsedLog | TaskEvent)[] = [];
    let currentTask: TaskEvent | null = null;

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
