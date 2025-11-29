/**
 * Federation Data Anonymizer
 * Converts sensitive local data into privacy-preserving federation messages
 *
 * Privacy Guarantees:
 * - No wallet addresses
 * - No private keys
 * - No task input/output data
 * - No IP addresses
 * - No exact execution IDs (hashed with salt)
 * - No exact metrics (bucketed into ranges)
 * - No exact timestamps (rounded to 5-minute intervals)
 */

import crypto from 'crypto';

class FederationAnonymizer {
  constructor(nodeId = null, salt = null) {
    // Random node ID (not wallet address)
    this.nodeId = nodeId || `node-${crypto.randomUUID()}`;

    // Secret salt for hashing (unique per node)
    this.salt = salt || crypto.randomBytes(32).toString('hex');
  }

  /**
   * Anonymize task received event
   */
  anonymizeTaskReceived(task) {
    return {
      version: '1.0',
      type: 'task_received',
      nodeId: this.nodeId,
      timestamp: this.roundTimestamp(task.received_at || new Date()),
      data: {
        chainId: task.chain_id,
        blockNumber: task.block_number,
        blockHash: task.block_hash,
        taskHash: task.task_hash,
        taskType: task.task_type || 'unknown',
        // PRIVACY: Hash execution ID with secret salt
        taskIdHash: this.hashWithSalt(task.execution_id || task.id)
      }
    };
  }

  /**
   * Anonymize task completed event
   */
  anonymizeTaskCompleted(task) {
    return {
      version: '1.0',
      type: 'task_completed',
      nodeId: this.nodeId,
      timestamp: this.roundTimestamp(task.completed_at || new Date()),
      data: {
        chainId: task.chain_id,
        blockNumber: task.block_number,
        blockHash: task.block_hash,
        taskHash: task.task_hash,
        taskIdHash: this.hashWithSalt(task.execution_id || task.id),

        // Success/failure (binary indicator, no error details)
        status: task.status,
        success: task.exit_code === 0,

        // PRIVACY: Bucket metrics into ranges (not exact values)
        executionTimeBucket: this.bucketExecutionTime(task.elapsed_ms),
        gasUsedBucket: this.bucketGasUsage(task.gas_used),

        // Binary flag for caching (no system details)
        cached: !!task.cached
      }
    };
  }

  /**
   * Anonymize node heartbeat
   */
  anonymizeHeartbeat(nodeStatus) {
    return {
      version: '1.0',
      type: 'heartbeat',
      nodeId: this.nodeId,
      timestamp: this.roundTimestamp(new Date()),
      data: {
        // Only high-level status, no system details
        status: nodeStatus.connected ? 'online' : 'offline',
        // Bucket active tasks (not exact count)
        activeTasksBucket: this.bucketActiveTasks(nodeStatus.activeTasks || 0),
        // Bucket total tasks processed (no exact count)
        totalTasksBucket: this.bucketTotalTasks(nodeStatus.totalTasks || 0)
      }
    };
  }

  /**
   * Anonymize invoice created event
   */
  anonymizeInvoice(invoice) {
    // Extract details from invoice
    const details = typeof invoice.details === 'string'
      ? JSON.parse(invoice.details)
      : invoice.details || {};

    const stepsComputed = details.totalStepsComputed || details.lineItem?.[0]?.total_steps_computed || 0;
    const memoryUsed = details.peakMemoryUsed || details.lineItem?.[0]?.peak_memory_used || 0;

    return {
      version: '1.0',
      type: 'invoice_created',
      nodeId: this.nodeId,
      timestamp: this.roundTimestamp(invoice.timestamp || new Date()),
      data: {
        // PRIVACY: Hash invoice and task IDs
        invoiceIdHash: this.hashWithSalt(details.invoiceId || invoice.id),
        taskIdHash: this.hashWithSalt(details.taskId || details.executionId),
        chainId: details.chainId,
        // Bucket compute metrics
        stepsComputedBucket: this.bucketStepsComputed(stepsComputed),
        memoryUsedBucket: this.bucketMemoryUsed(memoryUsed),
        operation: details.operation || details.lineItem?.[0]?.operation || 'compute'
      }
    };
  }

  /**
   * Bucket steps computed into ranges
   */
  bucketStepsComputed(steps) {
    if (!steps || steps < 0) return 'unknown';

    if (steps < 100000) return '<100K';
    if (steps < 1000000) return '100K-1M';
    if (steps < 10000000) return '1M-10M';
    if (steps < 100000000) return '10M-100M';
    return '>100M';
  }

  /**
   * Bucket memory used into ranges
   */
  bucketMemoryUsed(bytes) {
    if (!bytes || bytes < 0) return 'unknown';

    const mb = bytes / (1024 * 1024);
    if (mb < 64) return '<64MB';
    if (mb < 256) return '64-256MB';
    if (mb < 1024) return '256MB-1GB';
    return '>1GB';
  }

  /**
   * Hash value with secret salt (one-way, irreversible)
   */
  hashWithSalt(value) {
    if (!value) return null;
    return crypto
      .createHash('sha256')
      .update(value + this.salt)
      .digest('hex');
  }

  /**
   * Round timestamp to 5-minute intervals
   * Prevents timing correlation attacks
   */
  roundTimestamp(timestamp) {
    const date = new Date(timestamp);
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / 5) * 5;
    date.setMinutes(roundedMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date.toISOString();
  }

  /**
   * Bucket execution time into ranges
   * Prevents node fingerprinting based on exact performance
   */
  bucketExecutionTime(elapsedMs) {
    if (!elapsedMs || elapsedMs < 0) return 'unknown';

    if (elapsedMs < 100) return '<100ms';
    if (elapsedMs < 500) return '100-500ms';
    if (elapsedMs < 1000) return '500ms-1s';
    if (elapsedMs < 5000) return '1-5s';
    if (elapsedMs < 10000) return '5-10s';
    if (elapsedMs < 30000) return '10-30s';
    if (elapsedMs < 60000) return '30s-1m';
    return '>1m';
  }

  /**
   * Bucket gas usage into ranges
   */
  bucketGasUsage(gasUsed) {
    if (!gasUsed || gasUsed < 0) return 'unknown';

    if (gasUsed < 100000) return '<100K';
    if (gasUsed < 1000000) return '100K-1M';
    if (gasUsed < 10000000) return '1M-10M';
    if (gasUsed < 100000000) return '10M-100M';
    return '>100M';
  }

  /**
   * Bucket active tasks (not exact count)
   */
  bucketActiveTasks(count) {
    if (count === 0) return '0';
    if (count === 1) return '1';
    if (count <= 3) return '2-3';
    if (count <= 5) return '4-5';
    return '>5';
  }

  /**
   * Bucket total tasks (not exact count)
   */
  bucketTotalTasks(count) {
    if (count === 0) return '0';
    if (count < 10) return '1-10';
    if (count < 50) return '10-50';
    if (count < 100) return '50-100';
    if (count < 500) return '100-500';
    if (count < 1000) return '500-1K';
    return '>1K';
  }

  /**
   * Get node credentials for federation
   */
  getNodeCredentials() {
    return {
      nodeId: this.nodeId,
      salt: this.salt
    };
  }

  /**
   * Save credentials to use across restarts
   */
  serializeCredentials() {
    return JSON.stringify({
      nodeId: this.nodeId,
      salt: this.salt,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Load credentials from saved state
   */
  static deserializeCredentials(json) {
    try {
      const data = JSON.parse(json);
      return new FederationAnonymizer(data.nodeId, data.salt);
    } catch (e) {
      // If deserialization fails, create new credentials
      return new FederationAnonymizer();
    }
  }

  /**
   * Validate that message is safe for federation
   * Throws error if privacy violations detected
   */
  validateMessage(message) {
    const json = JSON.stringify(message);

    // Check for wallet addresses
    if (/0x[a-fA-F0-9]{40}/.test(json)) {
      throw new Error('Privacy violation: Wallet address detected in message');
    }

    // Check for execution IDs in cleartext
    if (/"execution_id":/i.test(json)) {
      throw new Error('Privacy violation: Execution ID in cleartext');
    }

    // Check for sensitive fields
    if (/"(input_data|output_data|error_data|private_key|wallet)":/i.test(json)) {
      throw new Error('Privacy violation: Sensitive field detected in message');
    }

    // Check for IP addresses
    if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(json)) {
      throw new Error('Privacy violation: IP address detected in message');
    }

    return true;
  }
}

export default FederationAnonymizer;
