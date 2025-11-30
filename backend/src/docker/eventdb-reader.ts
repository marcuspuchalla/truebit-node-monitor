/**
 * Reader for TrueBit's EventDB JSON files
 * Provides structured access to task, invoice, and outcome data
 */

import type Docker from 'dockerode';
import type { Readable } from 'stream';

export interface EventDB {
  records?: EventDBRecord[];
}

export interface EventDBRecord {
  type?: string;
  payload?: TaskPayload;
  messageId?: string;
  executionId?: string;
  senderAddress?: string;
  encryptedSolution?: string;
  signature?: string;
  msgHash?: string;
  taskId?: string;
  invoiceId?: string;
  taskCreated_timeStamp?: string;
  stepGasPrice?: number;
  lineItem?: LineItem[];
  accounting_signature?: string;
}

interface TaskPayload {
  type?: string;
  executionId?: string;
  timestamp?: string;
  message?: TaskMessage;
  signature?: string;
  msgHash?: string;
}

interface TaskMessage {
  taskId?: string;
  taskPath?: string;
  taskVersion?: string;
  chainId?: string;
  blockNumber?: number;
  blockHash?: string;
  taskRequesterAddress?: string;
  senderAddress?: string;
  input?: string;
  limits?: unknown;
  econParams?: unknown;
  workers?: unknown;
}

interface LineItem {
  total_steps_computed?: number;
  peak_memory_used?: number;
  account?: string;
  operation?: string;
}

export interface ParsedTaskCreated {
  type: 'task_created';
  executionId?: string;
  messageId?: string;
  timestamp: Date;
  taskId?: string;
  taskPath?: string;
  taskVersion?: string;
  chainId?: string;
  blockNumber?: number;
  blockHash?: string;
  taskRequesterAddress?: string;
  senderAddress?: string;
  input: unknown;
  limits?: unknown;
  econParams?: unknown;
  workers?: unknown;
  signature?: string;
  msgHash?: string;
}

export interface ParsedComputedOutcome {
  type: 'computed_outcome';
  executionId?: string;
  senderAddress?: string;
  encryptedSolution?: string;
  signature?: string;
  msgHash?: string;
}

export interface ParsedInvoice {
  type: 'invoice';
  executionId?: string;
  taskId?: string;
  invoiceId?: string;
  taskCreatedTimestamp: Date;
  stepGasPrice?: number;
  lineItems?: LineItem[];
  accountingSignature?: string;
  totalStepsComputed?: number;
  peakMemoryUsed?: number;
  chargedAccount?: string;
  operation?: string;
}

export interface ParsedEvents {
  tasks: ParsedTaskCreated[];
  outcomes: ParsedComputedOutcome[];
  invoices: ParsedInvoice[];
}

class EventDBReader {
  private container: Docker.Container;
  private eventDBPath: string;

  constructor(container: Docker.Container) {
    this.container = container;
    this.eventDBPath = '/app/build/datadb';
  }

  /**
   * Execute command in container and return output
   */
  private async execCommand(cmd: string): Promise<string> {
    const exec = await this.container.exec({
      Cmd: ['sh', '-c', cmd],
      AttachStdout: true,
      AttachStderr: true
    });

    const stream = await exec.start({ hijack: false, stdin: false }) as unknown as Readable;

    return new Promise((resolve, reject) => {
      let output = '';
      stream.on('data', (chunk: Buffer) => {
        // Remove Docker stream header (8 bytes)
        output += chunk.toString('utf8').substring(8);
      });
      stream.on('end', () => resolve(output));
      stream.on('error', reject);
    });
  }

  /**
   * Find and read the EventDB JSON file
   */
  async readEventDB(): Promise<EventDB> {
    try {
      // List files in datadb directory
      const filesOutput = await this.execCommand(`ls -1 ${this.eventDBPath}`);
      const files = filesOutput.split('\n').filter(f => f.endsWith('-eventDB.json'));

      if (files.length === 0) {
        console.log('   No EventDB file found');
        return { records: [] };
      }

      const eventDBFile = `${this.eventDBPath}/${files[0]}`;
      console.log(`   Reading EventDB: ${files[0]}`);

      // Read the file
      const content = await this.execCommand(`cat ${eventDBFile}`);

      // Parse JSON
      const eventDB = JSON.parse(content) as EventDB;
      console.log(`   Found ${eventDB.records?.length || 0} records in EventDB`);

      return eventDB;
    } catch (error) {
      console.error('   Failed to read EventDB:', (error as Error).message);
      return { records: [] };
    }
  }

  /**
   * Parse EventDB records into structured events
   */
  parseEventDB(eventDB: EventDB): ParsedEvents {
    const events: ParsedEvents = {
      tasks: [],
      outcomes: [],
      invoices: []
    };

    if (!eventDB.records || !Array.isArray(eventDB.records)) {
      return events;
    }

    for (const record of eventDB.records) {
      try {
        // Check if it's a task_created event
        if (record.payload && record.payload.type === 'task_created') {
          events.tasks.push(this.parseTaskCreated(record));
        }
        // Check if it's a computed_outcome
        else if (record.type === 'computed_outcome') {
          events.outcomes.push(this.parseComputedOutcome(record));
        }
        // Check if it's an invoice
        else if (record.type === 'invoice') {
          events.invoices.push(this.parseInvoice(record));
        }
      } catch (error) {
        console.error('   Error parsing EventDB record:', (error as Error).message);
      }
    }

    return events;
  }

  /**
   * Parse task_created record
   */
  private parseTaskCreated(record: EventDBRecord): ParsedTaskCreated {
    const payload = record.payload!;
    const message = payload.message!;

    return {
      type: 'task_created',
      executionId: payload.executionId,
      messageId: record.messageId,
      timestamp: new Date(payload.timestamp!),
      taskId: message.taskId,
      taskPath: message.taskPath,
      taskVersion: message.taskVersion,
      chainId: message.chainId,
      blockNumber: message.blockNumber,
      blockHash: message.blockHash,
      taskRequesterAddress: message.taskRequesterAddress,
      senderAddress: message.senderAddress,
      input: message.input ? JSON.parse(message.input) : null,
      limits: message.limits,
      econParams: message.econParams,
      workers: message.workers,
      signature: payload.signature,
      msgHash: payload.msgHash
    };
  }

  /**
   * Parse computed_outcome record
   */
  private parseComputedOutcome(record: EventDBRecord): ParsedComputedOutcome {
    return {
      type: 'computed_outcome',
      executionId: record.executionId,
      senderAddress: record.senderAddress,
      encryptedSolution: record.encryptedSolution,
      signature: record.signature,
      msgHash: record.msgHash
    };
  }

  /**
   * Parse invoice record
   */
  private parseInvoice(record: EventDBRecord): ParsedInvoice {
    return {
      type: 'invoice',
      executionId: record.executionId,
      taskId: record.taskId,
      invoiceId: record.invoiceId,
      taskCreatedTimestamp: new Date(record.taskCreated_timeStamp!),
      stepGasPrice: record.stepGasPrice,
      lineItems: record.lineItem,
      accountingSignature: record.accounting_signature,
      // Extract key metrics from line items
      totalStepsComputed: record.lineItem?.[0]?.total_steps_computed,
      peakMemoryUsed: record.lineItem?.[0]?.peak_memory_used,
      chargedAccount: record.lineItem?.[0]?.account,
      operation: record.lineItem?.[0]?.operation
    };
  }
}

export default EventDBReader;
