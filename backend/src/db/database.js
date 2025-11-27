import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

class TruebitDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  async initialize() {
    try {
      // Ensure data directory exists
      await mkdir(dirname(this.dbPath), { recursive: true });

      // Open database
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL'); // Better concurrency

      // Create tables
      this.createTables();

      console.log(`✓ Database initialized: ${this.dbPath}`);
    } catch (error) {
      console.error('Failed to initialize database:', error.message);
      throw error;
    }
  }

  createTables() {
    // Tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        execution_id TEXT UNIQUE NOT NULL,
        received_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        status TEXT NOT NULL DEFAULT 'received',
        task_type TEXT,
        task_hash TEXT,
        chain_id TEXT,
        block_number INTEGER,
        block_hash TEXT,
        input_data TEXT,
        output_data TEXT,
        error_data TEXT,
        elapsed_ms REAL,
        gas_limit INTEGER,
        gas_used INTEGER,
        memory_limit INTEGER,
        memory_peak INTEGER,
        exit_code INTEGER,
        cached BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Invoices table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        event_type TEXT,
        slot_used INTEGER,
        details TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add index on invoice ID from details to prevent duplicates
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_id
      ON invoices((json_extract(details, '$.invoiceId')))
    `);

    // Logs table (for raw log storage)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        timestamp_original TEXT,
        level TEXT NOT NULL,
        type TEXT,
        message TEXT NOT NULL,
        execution_id TEXT,
        data TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Node status table (single row for current status)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS node_status (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        address TEXT,
        version TEXT,
        total_cores INTEGER,
        current_slots INTEGER DEFAULT 0,
        total_slots INTEGER,
        registered BOOLEAN DEFAULT 0,
        last_seen TEXT,
        started_at TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Federation settings table (single row for configuration)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS federation_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled BOOLEAN DEFAULT 0,
        node_id TEXT,
        salt TEXT,
        privacy_level TEXT DEFAULT 'balanced',
        share_tasks BOOLEAN DEFAULT 1,
        share_stats BOOLEAN DEFAULT 1,
        nats_servers TEXT,
        nats_token TEXT,
        tls_enabled BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Federation messages table (received messages from other nodes)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS federation_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_type TEXT NOT NULL,
        sender_node_id TEXT NOT NULL,
        received_at TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Federation peers table (other nodes in the network)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS federation_peers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT UNIQUE NOT NULL,
        first_seen TEXT NOT NULL,
        last_seen TEXT NOT NULL,
        message_count INTEGER DEFAULT 0,
        reputation_score REAL DEFAULT 1.0,
        is_trusted BOOLEAN DEFAULT 0,
        is_blocked BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Federation network statistics (aggregated from all nodes)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS federation_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stat_type TEXT NOT NULL,
        stat_value REAL NOT NULL,
        node_count INTEGER DEFAULT 1,
        recorded_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_execution_id ON tasks(execution_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_received_at ON tasks(received_at);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_logs_execution_id ON logs(execution_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_timestamp ON invoices(timestamp);
      CREATE INDEX IF NOT EXISTS idx_federation_messages_type ON federation_messages(message_type);
      CREATE INDEX IF NOT EXISTS idx_federation_messages_sender ON federation_messages(sender_node_id);
      CREATE INDEX IF NOT EXISTS idx_federation_messages_received_at ON federation_messages(received_at);
      CREATE INDEX IF NOT EXISTS idx_federation_peers_node_id ON federation_peers(node_id);
      CREATE INDEX IF NOT EXISTS idx_federation_stats_type ON federation_stats(stat_type);
      CREATE INDEX IF NOT EXISTS idx_federation_stats_recorded_at ON federation_stats(recorded_at);
    `);

    // Add unique constraint on logs to prevent duplicates
    // Use timestamp_original + message as unique key
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_unique
      ON logs(timestamp_original, message)
    `);

    // Initialize node_status if empty
    const nodeStatus = this.db.prepare('SELECT COUNT(*) as count FROM node_status').get();
    if (nodeStatus.count === 0) {
      this.db.prepare(`
        INSERT INTO node_status (id, current_slots, total_slots)
        VALUES (1, 0, 4)
      `).run();
    }
  }

  // ===== TASKS =====

  insertTask(task) {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        execution_id, received_at, status, task_type, task_hash,
        chain_id, block_number, block_hash, input_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      task.executionId,
      task.receivedAt,
      task.status || 'received',
      task.taskType,
      task.taskHash,
      task.chainId,
      task.blockNumber,
      task.blockHash,
      JSON.stringify(task.inputData)
    );
  }

  updateTaskStart(executionId, startedAt) {
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET started_at = ?, status = 'executing'
      WHERE execution_id = ?
    `);

    return stmt.run(startedAt, executionId);
  }

  updateTaskComplete(executionId, data) {
    const stmt = this.db.prepare(`
      UPDATE tasks
      SET completed_at = ?,
          status = ?,
          output_data = ?,
          error_data = ?,
          elapsed_ms = ?,
          gas_limit = ?,
          gas_used = ?,
          memory_limit = ?,
          memory_peak = ?,
          exit_code = ?,
          cached = ?
      WHERE execution_id = ?
    `);

    return stmt.run(
      data.completedAt,
      data.status || 'completed',
      data.outputData ? JSON.stringify(data.outputData) : null,
      data.errorData ? JSON.stringify(data.errorData) : null,
      data.elapsedMs,
      data.gasLimit,
      data.gasUsed,
      data.memoryLimit,
      data.memoryPeak,
      data.exitCode,
      data.cached ? 1 : 0,
      executionId
    );
  }

  getTask(executionId) {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE execution_id = ?');
    return stmt.get(executionId);
  }

  getTasks(limit = 50, offset = 0, status = null) {
    let query = 'SELECT * FROM tasks';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getTaskStats() {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'executing' THEN 1 ELSE 0 END) as executing,
        AVG(CASE WHEN elapsed_ms IS NOT NULL THEN elapsed_ms ELSE NULL END) as avg_elapsed_ms,
        AVG(CASE WHEN gas_used IS NOT NULL THEN gas_used ELSE NULL END) as avg_gas_used
      FROM tasks
    `);
    return stmt.get();
  }

  // ===== INVOICES =====

  insertInvoice(invoice) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO invoices (timestamp, event_type, slot_used, details)
      VALUES (?, ?, ?, ?)
    `);

    return stmt.run(
      invoice.timestamp,
      invoice.eventType,
      invoice.slotUsed,
      invoice.details ? JSON.stringify(invoice.details) : null
    );
  }

  getInvoices(limit = 50, offset = 0) {
    const stmt = this.db.prepare(`
      SELECT * FROM invoices
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  getInvoiceCount() {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM invoices');
    return stmt.get().count;
  }

  // ===== LOGS =====

  insertLog(log) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO logs (timestamp, timestamp_original, level, type, message, execution_id, data)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      log.timestamp,
      log.timestampOriginal || null,
      log.level,
      log.type,
      log.message,
      log.executionId,
      log.data ? JSON.stringify(log.data) : null
    );
  }

  getLogs(limit = 100, offset = 0, level = null, type = null, search = null) {
    let query = 'SELECT * FROM logs WHERE 1=1';
    const params = [];

    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }

    if (search) {
      query += ' AND message LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  // ===== NODE STATUS =====

  updateNodeStatus(status) {
    const stmt = this.db.prepare(`
      UPDATE node_status
      SET address = ?,
          version = ?,
          total_cores = ?,
          registered = ?,
          last_seen = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);

    return stmt.run(
      status.address,
      status.version,
      status.totalCores,
      status.registered ? 1 : 0,
      status.lastSeen
    );
  }

  updateNodeSlots(current, total) {
    const stmt = this.db.prepare(`
      UPDATE node_status
      SET current_slots = ?,
          total_slots = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);

    return stmt.run(current, total);
  }

  updateNodeStartTime(startedAt) {
    const stmt = this.db.prepare(`
      UPDATE node_status
      SET started_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);

    return stmt.run(startedAt);
  }

  getNodeStatus() {
    const stmt = this.db.prepare('SELECT * FROM node_status WHERE id = 1');
    return stmt.get();
  }

  // ===== MAINTENANCE =====

  cleanOldLogs(retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const stmt = this.db.prepare(`
      DELETE FROM logs
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    console.log(`Cleaned ${result.changes} old log entries`);
    return result.changes;
  }

  // ===== FEDERATION =====

  // Federation Settings
  getFederationSettings() {
    const stmt = this.db.prepare('SELECT * FROM federation_settings WHERE id = 1');
    return stmt.get();
  }

  initializeFederationSettings(nodeId, salt) {
    const existing = this.getFederationSettings();
    if (existing) return existing;

    const stmt = this.db.prepare(`
      INSERT INTO federation_settings (id, enabled, node_id, salt, privacy_level)
      VALUES (1, 0, ?, ?, 'balanced')
    `);
    stmt.run(nodeId, salt);
    return this.getFederationSettings();
  }

  updateFederationSettings(settings) {
    // Build dynamic UPDATE query - only update fields that are provided
    const updates = [];
    const values = [];

    if (settings.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(settings.enabled ? 1 : 0);
    }
    if (settings.privacyLevel !== undefined) {
      updates.push('privacy_level = ?');
      values.push(settings.privacyLevel);
    }
    if (settings.shareTasks !== undefined) {
      updates.push('share_tasks = ?');
      values.push(settings.shareTasks ? 1 : 0);
    }
    if (settings.shareStats !== undefined) {
      updates.push('share_stats = ?');
      values.push(settings.shareStats ? 1 : 0);
    }
    if (settings.natsServers !== undefined) {
      updates.push('nats_servers = ?');
      values.push(settings.natsServers ? JSON.stringify(settings.natsServers) : null);
    }
    if (settings.natsToken !== undefined) {
      updates.push('nats_token = ?');
      values.push(settings.natsToken || null);
    }
    if (settings.tlsEnabled !== undefined) {
      updates.push('tls_enabled = ?');
      values.push(settings.tlsEnabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return { changes: 0 };
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const stmt = this.db.prepare(`
      UPDATE federation_settings
      SET ${updates.join(', ')}
      WHERE id = 1
    `);

    return stmt.run(...values);
  }

  // Federation Messages
  insertFederationMessage(message) {
    const stmt = this.db.prepare(`
      INSERT INTO federation_messages (message_type, sender_node_id, received_at, data)
      VALUES (?, ?, ?, ?)
    `);

    return stmt.run(
      message.type,
      message.nodeId || message.sender_node_id,
      message.timestamp || new Date().toISOString(),
      JSON.stringify(message.data || message)
    );
  }

  getFederationMessages(limit = 100, offset = 0, type = null) {
    let query = 'SELECT * FROM federation_messages WHERE 1=1';
    const params = [];

    if (type) {
      query += ' AND message_type = ?';
      params.push(type);
    }

    query += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  cleanOldFederationMessages(retentionDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const stmt = this.db.prepare(`
      DELETE FROM federation_messages
      WHERE received_at < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  }

  // Federation Peers
  upsertFederationPeer(nodeId) {
    const now = new Date().toISOString();

    // Try to update existing peer
    const updateStmt = this.db.prepare(`
      UPDATE federation_peers
      SET last_seen = ?,
          message_count = message_count + 1,
          updated_at = ?
      WHERE node_id = ?
    `);

    const result = updateStmt.run(now, now, nodeId);

    // If no rows updated, insert new peer
    if (result.changes === 0) {
      const insertStmt = this.db.prepare(`
        INSERT INTO federation_peers (node_id, first_seen, last_seen, message_count)
        VALUES (?, ?, ?, 1)
      `);
      insertStmt.run(nodeId, now, now);
    }
  }

  getFederationPeers() {
    const stmt = this.db.prepare(`
      SELECT * FROM federation_peers
      WHERE is_blocked = 0
      ORDER BY last_seen DESC
    `);
    return stmt.all();
  }

  updatePeerReputation(nodeId, reputationDelta) {
    const stmt = this.db.prepare(`
      UPDATE federation_peers
      SET reputation_score = MAX(0, MIN(1, reputation_score + ?)),
          updated_at = CURRENT_TIMESTAMP
      WHERE node_id = ?
    `);
    return stmt.run(reputationDelta, nodeId);
  }

  blockPeer(nodeId) {
    const stmt = this.db.prepare(`
      UPDATE federation_peers
      SET is_blocked = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE node_id = ?
    `);
    return stmt.run(nodeId);
  }

  // Federation Statistics
  insertFederationStat(statType, statValue, nodeCount = 1) {
    const stmt = this.db.prepare(`
      INSERT INTO federation_stats (stat_type, stat_value, node_count, recorded_at)
      VALUES (?, ?, ?, ?)
    `);

    return stmt.run(
      statType,
      statValue,
      nodeCount,
      new Date().toISOString()
    );
  }

  getFederationStats(statType = null, hours = 24) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    let query = 'SELECT * FROM federation_stats WHERE recorded_at >= ?';
    const params = [cutoffDate.toISOString()];

    if (statType) {
      query += ' AND stat_type = ?';
      params.push(statType);
    }

    query += ' ORDER BY recorded_at DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params);
  }

  getAggregatedFederationStats() {
    const stmt = this.db.prepare(`
      SELECT
        stat_type,
        AVG(stat_value) as avg_value,
        MIN(stat_value) as min_value,
        MAX(stat_value) as max_value,
        COUNT(*) as sample_count,
        SUM(node_count) as total_nodes
      FROM federation_stats
      WHERE recorded_at >= datetime('now', '-24 hours')
      GROUP BY stat_type
    `);
    return stmt.all();
  }

  close() {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed');
    }
  }
}

export default TruebitDatabase;
