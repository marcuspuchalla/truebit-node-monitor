import { describe, it, expect, beforeEach } from 'vitest';
import FederationAnonymizer from './anonymizer.js';

describe('FederationAnonymizer', () => {
  let anonymizer: FederationAnonymizer;

  beforeEach(() => {
    anonymizer = new FederationAnonymizer('test-node-123', 'test-salt-abc');
  });

  describe('hashWithSalt', () => {
    it('should produce consistent hashes for same input', () => {
      const msg1 = anonymizer.anonymizeTaskReceived({ execution_id: 'task-123' });
      const msg2 = anonymizer.anonymizeTaskReceived({ execution_id: 'task-123' });
      expect(msg1.data.taskIdHash).toBe(msg2.data.taskIdHash);
    });

    it('should produce different hashes for different inputs', () => {
      const msg1 = anonymizer.anonymizeTaskReceived({ execution_id: 'task-123' });
      const msg2 = anonymizer.anonymizeTaskReceived({ execution_id: 'task-456' });
      expect(msg1.data.taskIdHash).not.toBe(msg2.data.taskIdHash);
    });

    it('should produce different hashes with different salts', () => {
      const anon1 = new FederationAnonymizer('node', 'salt-1');
      const anon2 = new FederationAnonymizer('node', 'salt-2');
      const msg1 = anon1.anonymizeTaskReceived({ execution_id: 'task-123' });
      const msg2 = anon2.anonymizeTaskReceived({ execution_id: 'task-123' });
      expect(msg1.data.taskIdHash).not.toBe(msg2.data.taskIdHash);
    });
  });

  describe('roundTimestamp', () => {
    it('should round to 5-minute intervals', () => {
      const msg1 = anonymizer.anonymizeHeartbeat({ connected: true });
      const timestamp = new Date(msg1.timestamp);
      expect(timestamp.getMinutes() % 5).toBe(0);
      expect(timestamp.getSeconds()).toBe(0);
      expect(timestamp.getMilliseconds()).toBe(0);
    });
  });

  describe('bucketExecutionTime', () => {
    it('should bucket execution times correctly', () => {
      const tests = [
        { elapsed_ms: 50, expected: '<100ms' },
        { elapsed_ms: 250, expected: '100-500ms' },
        { elapsed_ms: 750, expected: '500ms-1s' },
        { elapsed_ms: 3000, expected: '1-5s' },
        { elapsed_ms: 7000, expected: '5-10s' },
        { elapsed_ms: 20000, expected: '10-30s' },
        { elapsed_ms: 45000, expected: '30s-1m' },
        { elapsed_ms: 120000, expected: '>1m' },
      ];

      for (const test of tests) {
        const msg = anonymizer.anonymizeTaskCompleted({ elapsed_ms: test.elapsed_ms, status: 'completed', exit_code: 0 });
        expect(msg.data.executionTimeBucket).toBe(test.expected);
      }
    });

    it('should handle undefined/negative values', () => {
      const msg1 = anonymizer.anonymizeTaskCompleted({ status: 'completed', exit_code: 0 });
      expect(msg1.data.executionTimeBucket).toBe('unknown');

      const msg2 = anonymizer.anonymizeTaskCompleted({ elapsed_ms: -1, status: 'completed', exit_code: 0 });
      expect(msg2.data.executionTimeBucket).toBe('unknown');
    });
  });

  describe('bucketGasUsage', () => {
    it('should bucket gas usage correctly', () => {
      const tests = [
        { gas_used: 50000, expected: '<100K' },
        { gas_used: 500000, expected: '100K-1M' },
        { gas_used: 5000000, expected: '1M-10M' },
        { gas_used: 50000000, expected: '10M-100M' },
        { gas_used: 500000000, expected: '>100M' },
      ];

      for (const test of tests) {
        const msg = anonymizer.anonymizeTaskCompleted({ gas_used: test.gas_used, status: 'completed', exit_code: 0 });
        expect(msg.data.gasUsedBucket).toBe(test.expected);
      }
    });
  });

  describe('validateMessage', () => {
    it('should reject messages with wallet addresses', () => {
      const msg = { data: { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f1A1b2' } };
      expect(() => anonymizer.validateMessage(msg)).toThrow('Wallet address detected');
    });

    it('should reject messages with execution_id in cleartext', () => {
      const msg = { data: { execution_id: 'some-id' } };
      expect(() => anonymizer.validateMessage(msg)).toThrow('Execution ID in cleartext');
    });

    it('should reject messages with sensitive fields', () => {
      const sensitiveFields = ['input_data', 'output_data', 'error_data', 'private_key', 'wallet'];
      for (const field of sensitiveFields) {
        const msg = { data: { [field]: 'value' } };
        expect(() => anonymizer.validateMessage(msg)).toThrow('Sensitive field detected');
      }
    });

    it('should reject messages with IP addresses', () => {
      const msg = { data: { ip: '192.168.1.1' } };
      expect(() => anonymizer.validateMessage(msg)).toThrow('IP address detected');
    });

    it('should accept valid anonymized messages', () => {
      const msg = anonymizer.anonymizeTaskCompleted({
        execution_id: 'task-123',
        status: 'completed',
        exit_code: 0,
        elapsed_ms: 1000,
        gas_used: 100000,
      });
      expect(() => anonymizer.validateMessage(msg)).not.toThrow();
    });
  });

  describe('anonymizeTaskReceived', () => {
    it('should include required fields', () => {
      const msg = anonymizer.anonymizeTaskReceived({
        execution_id: 'task-123',
        chain_id: '1',
        task_type: 'wasm',
      });

      expect(msg.version).toBe('1.0');
      expect(msg.type).toBe('task_received');
      expect(msg.nodeId).toBe('test-node-123');
      expect(msg.data.chainId).toBe('1');
      expect(msg.data.taskType).toBe('wasm');
      expect(msg.data.taskIdHash).toBeDefined();
      expect(typeof msg.data.taskIdHash).toBe('string');
    });

    it('should NOT include raw execution_id', () => {
      const msg = anonymizer.anonymizeTaskReceived({ execution_id: 'secret-task-id' });
      const json = JSON.stringify(msg);
      expect(json).not.toContain('secret-task-id');
    });
  });

  describe('anonymizeHeartbeat', () => {
    it('should include bucketed counts', () => {
      const msg = anonymizer.anonymizeHeartbeat({
        connected: true,
        activeTasks: 3,
        totalTasks: 150,
      });

      expect(msg.data.status).toBe('online');
      expect(msg.data.activeTasksBucket).toBe('2-3');
      expect(msg.data.totalTasksBucket).toBe('100-500');
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize credentials', () => {
      const serialized = anonymizer.serializeCredentials();
      const restored = FederationAnonymizer.deserializeCredentials(serialized);

      expect(restored.nodeId).toBe(anonymizer.nodeId);

      // Verify same hash output (means same salt)
      const msg1 = anonymizer.anonymizeTaskReceived({ execution_id: 'test' });
      const msg2 = restored.anonymizeTaskReceived({ execution_id: 'test' });
      expect(msg1.data.taskIdHash).toBe(msg2.data.taskIdHash);
    });

    it('should create new credentials on invalid JSON', () => {
      const restored = FederationAnonymizer.deserializeCredentials('invalid json');
      expect(restored.nodeId).toContain('node-');
    });
  });
});
