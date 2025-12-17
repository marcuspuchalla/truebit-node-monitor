import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export interface Task {
  executionId: string;
  receivedAt: string;
  status?: string;
  taskType?: string;
  taskHash?: string;
  chainId?: string;
  blockNumber?: number;
  blockHash?: string;
  inputData?: unknown;
}

export interface TaskComplete {
  completedAt?: string;
  status?: string;
  outputData?: unknown;
  errorData?: unknown;
  elapsedMs?: number;
  gasLimit?: number;
  gasUsed?: number;
  memoryLimit?: number;
  memoryPeak?: number;
  exitCode?: number;
  cached?: boolean;
}

export interface Invoice {
  timestamp: string;
  eventType?: string;
  slotUsed?: number | null;
  details?: unknown;
}

export interface LogEntry {
  timestamp: string;
  timestampOriginal?: string | null;
  level: string;
  type?: string;
  message: string;
  executionId?: string | null;
  data?: unknown;
}

export interface NodeStatus {
  address?: string;
  version?: string;
  totalCores?: number;
  registered?: boolean;
  lastSeen?: string;
}

export interface FederationSettings {
  enabled?: boolean;
  privacyLevel?: string;
  shareTasks?: boolean;
  shareStats?: boolean;
  natsServers?: string[];
  natsToken?: string | null;
  tlsEnabled?: boolean;
}

export interface FederationMessage {
  type: string;
  nodeId?: string;
  sender_node_id?: string;
  timestamp?: string;
  data?: unknown;
}

export interface NetworkStats {
  activeNodes?: number;
  totalNodes?: number;
  totalTasks?: number;
  completedTasks?: number;
  failedTasks?: number;
  cachedTasks?: number;
  tasksLast24h?: number;
  totalInvoices?: number;
  invoicesLast24h?: number;
  successRate?: number;
  cacheHitRate?: number;
  executionTimeDistribution?: Record<string, number>;
  gasUsageDistribution?: Record<string, number>;
  stepsComputedDistribution?: Record<string, number>;
  memoryUsedDistribution?: Record<string, number>;
  chainDistribution?: Record<string, number>;
  taskTypeDistribution?: Record<string, number>;
}

class TruebitDatabase {
  private dbPath: string;
  private db: Database.Database | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
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
      console.error('Failed to initialize database:', (error as Error).message);
      throw error;
    }
  }

  private createTables(): void {
    // Tasks table
    this.db!.exec(`
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
    this.db!.exec(`
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
    this.db!.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_id
      ON invoices((json_extract(details, '$.invoiceId')))
    `);

    // Logs table (for raw log storage)
    this.db!.exec(`
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
    this.db!.exec(`
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
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS federation_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        enabled BOOLEAN DEFAULT 1,
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
    this.db!.exec(`
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
    this.db!.exec(`
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
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS federation_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stat_type TEXT NOT NULL,
        stat_value REAL NOT NULL,
        node_count INTEGER DEFAULT 1,
        recorded_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Network-wide statistics cache (received from aggregator)
    this.db!.exec(`
      CREATE TABLE IF NOT EXISTS network_stats_cache (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        active_nodes INTEGER,
        total_nodes INTEGER,
        total_tasks INTEGER,
        completed_tasks INTEGER,
        failed_tasks INTEGER,
        cached_tasks INTEGER,
        tasks_last_24h INTEGER,
        total_invoices INTEGER,
        invoices_last_24h INTEGER,
        success_rate REAL,
        cache_hit_rate REAL,
        execution_time_distribution TEXT,
        gas_usage_distribution TEXT,
        steps_computed_distribution TEXT,
        memory_used_distribution TEXT,
        chain_distribution TEXT,
        task_type_distribution TEXT,
        last_updated TEXT
      )
    `);

    // Create indexes
    this.db!.exec(`
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
    this.db!.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_logs_unique
      ON logs(timestamp_original, message)
    `);

    // Initialize node_status if empty
    const nodeStatus = this.db!.prepare('SELECT COUNT(*) as count FROM node_status').get() as { count: number };
    if (nodeStatus.count === 0) {
      this.db!.prepare(`
        INSERT INTO node_status (id, current_slots, total_slots)
        VALUES (1, 0, 4)
      `).run();
    }
  }

  // ===== TASKS =====

  insertTask(task: Task): Database.RunResult {
    const stmt = this.db!.prepare(`
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

  updateTaskStart(executionId: string, startedAt: string): Database.RunResult {
    const stmt = this.db!.prepare(`
      UPDATE tasks
      SET started_at = ?, status = 'executing'
      WHERE execution_id = ?
    `);

    return stmt.run(startedAt, executionId);
  }

  updateTaskComplete(executionId: string, data: TaskComplete): Database.RunResult {
    const stmt = this.db!.prepare(`
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

  getTask(executionId: string): unknown {
    const stmt = this.db!.prepare('SELECT * FROM tasks WHERE execution_id = ?');
    return stmt.get(executionId);
  }

  getTasks(limit: number = 50, offset: number = 0, status: string | null = null): unknown[] {
    let query = 'SELECT * FROM tasks';
    const params: (string | number)[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db!.prepare(query);
    return stmt.all(...params);
  }

  getTaskStats(): { total: number; completed: number; failed: number; executing: number; avg_elapsed_ms: number | null; avg_gas_used: number | null } {
    const stmt = this.db!.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'executing' THEN 1 ELSE 0 END) as executing,
        AVG(CASE WHEN elapsed_ms IS NOT NULL THEN elapsed_ms ELSE NULL END) as avg_elapsed_ms,
        AVG(CASE WHEN gas_used IS NOT NULL THEN gas_used ELSE NULL END) as avg_gas_used
      FROM tasks
    `);
    return stmt.get() as { total: number; completed: number; failed: number; executing: number; avg_elapsed_ms: number | null; avg_gas_used: number | null };
  }

  // ===== INVOICES =====

  insertInvoice(invoice: Invoice): Database.RunResult {
    const stmt = this.db!.prepare(`
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

  getInvoices(limit: number = 50, offset: number = 0): unknown[] {
    const stmt = this.db!.prepare(`
      SELECT * FROM invoices
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  }

  getInvoiceCount(): number {
    const stmt = this.db!.prepare('SELECT COUNT(*) as count FROM invoices');
    return (stmt.get() as { count: number }).count;
  }

  // ===== LOGS =====

  insertLog(log: LogEntry): Database.RunResult {
    const stmt = this.db!.prepare(`
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

  getLogs(limit: number = 100, offset: number = 0, level: string | null = null, type: string | null = null, search: string | null = null): unknown[] {
    let query = 'SELECT * FROM logs WHERE 1=1';
    const params: (string | number)[] = [];

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

    const stmt = this.db!.prepare(query);
    return stmt.all(...params);
  }

  // ===== NODE STATUS =====

  updateNodeStatus(status: NodeStatus): Database.RunResult {
    const stmt = this.db!.prepare(`
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

  updateNodeSlots(current: number, total: number): Database.RunResult {
    const stmt = this.db!.prepare(`
      UPDATE node_status
      SET current_slots = ?,
          total_slots = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);

    return stmt.run(current, total);
  }

  updateNodeStartTime(startedAt: string): Database.RunResult {
    const stmt = this.db!.prepare(`
      UPDATE node_status
      SET started_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);

    return stmt.run(startedAt);
  }

  getNodeStatus(): unknown {
    const stmt = this.db!.prepare('SELECT * FROM node_status WHERE id = 1');
    return stmt.get();
  }

  // ===== MAINTENANCE =====

  cleanOldLogs(retentionDays: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const stmt = this.db!.prepare(`
      DELETE FROM logs
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    console.log(`Cleaned ${result.changes} old log entries`);
    return result.changes;
  }

  // ===== FEDERATION =====

  // Federation Settings
  getFederationSettings(): { enabled: number; node_id: string; salt: string; privacy_level: string; share_tasks: number; share_stats: number; nats_servers: string | null; nats_token: string | null; tls_enabled: number; created_at: string; updated_at: string } | undefined {
    const stmt = this.db!.prepare('SELECT * FROM federation_settings WHERE id = 1');
    return stmt.get() as { enabled: number; node_id: string; salt: string; privacy_level: string; share_tasks: number; share_stats: number; nats_servers: string | null; nats_token: string | null; tls_enabled: number; created_at: string; updated_at: string } | undefined;
  }

  initializeFederationSettings(nodeId: string, salt: string): unknown {
    const existing = this.getFederationSettings();
    if (existing) return existing;

    const stmt = this.db!.prepare(`
      INSERT INTO federation_settings (id, enabled, node_id, salt, privacy_level)
      VALUES (1, 1, ?, ?, 'balanced')
    `);
    stmt.run(nodeId, salt);
    return this.getFederationSettings();
  }

  updateFederationSettings(settings: FederationSettings): Database.RunResult {
    // Build dynamic UPDATE query - only update fields that are provided
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

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
      return { changes: 0 } as Database.RunResult;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    const stmt = this.db!.prepare(`
      UPDATE federation_settings
      SET ${updates.join(', ')}
      WHERE id = 1
    `);

    return stmt.run(...values);
  }

  // Federation Messages
  insertFederationMessage(message: FederationMessage): Database.RunResult | null {
    const messageType = message.type;
    const senderNodeId = message.nodeId || message.sender_node_id;
    const receivedAt = message.timestamp || new Date().toISOString();

    // Deduplicate: Check if same message type from same node within 2 seconds already exists
    const checkStmt = this.db!.prepare(`
      SELECT id FROM federation_messages
      WHERE message_type = ?
        AND sender_node_id = ?
        AND datetime(received_at) >= datetime(?, '-2 seconds')
        AND datetime(received_at) <= datetime(?, '+2 seconds')
      LIMIT 1
    `);

    const existing = checkStmt.get(messageType, senderNodeId, receivedAt, receivedAt);
    if (existing) {
      // Duplicate message, skip insertion
      return null;
    }

    const stmt = this.db!.prepare(`
      INSERT INTO federation_messages (message_type, sender_node_id, received_at, data)
      VALUES (?, ?, ?, ?)
    `);

    return stmt.run(
      messageType,
      senderNodeId,
      receivedAt,
      JSON.stringify(message.data || message)
    );
  }

  getFederationMessages(limit: number = 100, offset: number = 0, type: string | null = null): unknown[] {
    let query = 'SELECT * FROM federation_messages WHERE 1=1';
    const params: (string | number)[] = [];

    if (type) {
      query += ' AND message_type = ?';
      params.push(type);
    }

    query += ' ORDER BY received_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db!.prepare(query);
    return stmt.all(...params);
  }

  cleanOldFederationMessages(retentionDays: number = 7): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const stmt = this.db!.prepare(`
      DELETE FROM federation_messages
      WHERE received_at < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    return result.changes;
  }

  // Federation Peers
  upsertFederationPeer(nodeId: string): void {
    const now = new Date().toISOString();

    // Try to update existing peer
    const updateStmt = this.db!.prepare(`
      UPDATE federation_peers
      SET last_seen = ?,
          message_count = message_count + 1,
          updated_at = ?
      WHERE node_id = ?
    `);

    const result = updateStmt.run(now, now, nodeId);

    // If no rows updated, insert new peer
    if (result.changes === 0) {
      const insertStmt = this.db!.prepare(`
        INSERT INTO federation_peers (node_id, first_seen, last_seen, message_count)
        VALUES (?, ?, ?, 1)
      `);
      insertStmt.run(nodeId, now, now);
    }
  }

  getFederationPeers(): unknown[] {
    const stmt = this.db!.prepare(`
      SELECT * FROM federation_peers
      WHERE is_blocked = 0
      ORDER BY last_seen DESC
    `);
    return stmt.all();
  }

  updatePeerReputation(nodeId: string, reputationDelta: number): Database.RunResult {
    const stmt = this.db!.prepare(`
      UPDATE federation_peers
      SET reputation_score = MAX(0, MIN(1, reputation_score + ?)),
          updated_at = CURRENT_TIMESTAMP
      WHERE node_id = ?
    `);
    return stmt.run(reputationDelta, nodeId);
  }

  blockPeer(nodeId: string): Database.RunResult {
    const stmt = this.db!.prepare(`
      UPDATE federation_peers
      SET is_blocked = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE node_id = ?
    `);
    return stmt.run(nodeId);
  }

  /**
   * Get peers that haven't been seen for a specified number of minutes
   * @param minutesThreshold - Consider peers stale if not seen for this many minutes
   * @returns Array of stale peer node IDs
   */
  getStalePeers(minutesThreshold: number = 5): string[] {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - minutesThreshold);

    const stmt = this.db!.prepare(`
      SELECT node_id FROM federation_peers
      WHERE is_blocked = 0
        AND last_seen < ?
      ORDER BY last_seen ASC
    `);
    const rows = stmt.all(cutoffDate.toISOString()) as { node_id: string }[];
    return rows.map(row => row.node_id);
  }

  /**
   * Remove a peer from the peers table (used when node explicitly leaves)
   */
  removePeer(nodeId: string): Database.RunResult {
    const stmt = this.db!.prepare(`
      DELETE FROM federation_peers
      WHERE node_id = ?
    `);
    return stmt.run(nodeId);
  }

  /**
   * Clear all federation data (messages, peers, stats) for a fresh start
   * Preserves settings (enabled state, node ID, etc.)
   */
  clearFederationData(): { messages: number; peers: number; stats: number; networkCache: number } {
    const messagesResult = this.db!.prepare('DELETE FROM federation_messages').run();
    const peersResult = this.db!.prepare('DELETE FROM federation_peers').run();
    const statsResult = this.db!.prepare('DELETE FROM federation_stats').run();
    const networkCacheResult = this.db!.prepare('DELETE FROM network_stats_cache').run();

    return {
      messages: messagesResult.changes,
      peers: peersResult.changes,
      stats: statsResult.changes,
      networkCache: networkCacheResult.changes
    };
  }

  /**
   * Get active peers count (seen within the last X minutes)
   */
  getActivePeerCount(minutesThreshold: number = 2): number {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - minutesThreshold);

    const stmt = this.db!.prepare(`
      SELECT COUNT(*) as count FROM federation_peers
      WHERE is_blocked = 0
        AND last_seen >= ?
    `);
    const row = stmt.get(cutoffDate.toISOString()) as { count: number };
    return row.count;
  }

  // Federation Statistics
  insertFederationStat(statType: string, statValue: number, nodeCount: number = 1): Database.RunResult {
    const stmt = this.db!.prepare(`
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

  getFederationStats(statType: string | null = null, hours: number = 24): unknown[] {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    let query = 'SELECT * FROM federation_stats WHERE recorded_at >= ?';
    const params: (string | number)[] = [cutoffDate.toISOString()];

    if (statType) {
      query += ' AND stat_type = ?';
      params.push(statType);
    }

    query += ' ORDER BY recorded_at DESC';

    const stmt = this.db!.prepare(query);
    return stmt.all(...params);
  }

  getAggregatedFederationStats(): unknown[] {
    const stmt = this.db!.prepare(`
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

  // Network Stats Cache (from aggregator)
  updateNetworkStats(stats: { data?: NetworkStats } & NetworkStats): Database.RunResult {
    const data = stats.data || stats;
    const now = new Date().toISOString();

    // Check if row exists
    const existing = this.db!.prepare('SELECT COUNT(*) as count FROM network_stats_cache WHERE id = 1').get() as { count: number };

    if (existing.count === 0) {
      const stmt = this.db!.prepare(`
        INSERT INTO network_stats_cache (
          id, active_nodes, total_nodes, total_tasks, completed_tasks,
          failed_tasks, cached_tasks, tasks_last_24h, total_invoices,
          invoices_last_24h, success_rate, cache_hit_rate,
          execution_time_distribution, gas_usage_distribution,
          steps_computed_distribution, memory_used_distribution,
          chain_distribution, task_type_distribution, last_updated
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      return stmt.run(
        data.activeNodes,
        data.totalNodes,
        data.totalTasks,
        data.completedTasks,
        data.failedTasks,
        data.cachedTasks,
        data.tasksLast24h,
        data.totalInvoices,
        data.invoicesLast24h,
        data.successRate,
        data.cacheHitRate,
        JSON.stringify(data.executionTimeDistribution),
        JSON.stringify(data.gasUsageDistribution),
        JSON.stringify(data.stepsComputedDistribution),
        JSON.stringify(data.memoryUsedDistribution),
        JSON.stringify(data.chainDistribution),
        JSON.stringify(data.taskTypeDistribution),
        now
      );
    }

    const stmt = this.db!.prepare(`
      UPDATE network_stats_cache SET
        active_nodes = ?,
        total_nodes = ?,
        total_tasks = ?,
        completed_tasks = ?,
        failed_tasks = ?,
        cached_tasks = ?,
        tasks_last_24h = ?,
        total_invoices = ?,
        invoices_last_24h = ?,
        success_rate = ?,
        cache_hit_rate = ?,
        execution_time_distribution = ?,
        gas_usage_distribution = ?,
        steps_computed_distribution = ?,
        memory_used_distribution = ?,
        chain_distribution = ?,
        task_type_distribution = ?,
        last_updated = ?
      WHERE id = 1
    `);

    return stmt.run(
      data.activeNodes,
      data.totalNodes,
      data.totalTasks,
      data.completedTasks,
      data.failedTasks,
      data.cachedTasks,
      data.tasksLast24h,
      data.totalInvoices,
      data.invoicesLast24h,
      data.successRate,
      data.cacheHitRate,
      JSON.stringify(data.executionTimeDistribution),
      JSON.stringify(data.gasUsageDistribution),
      JSON.stringify(data.stepsComputedDistribution),
      JSON.stringify(data.memoryUsedDistribution),
      JSON.stringify(data.chainDistribution),
      JSON.stringify(data.taskTypeDistribution),
      now
    );
  }

  getNetworkStats(): NetworkStats | null {
    const stmt = this.db!.prepare('SELECT * FROM network_stats_cache WHERE id = 1');
    const row = stmt.get() as { active_nodes: number; total_nodes: number; total_tasks: number; completed_tasks: number; failed_tasks: number; cached_tasks: number; tasks_last_24h: number; total_invoices: number; invoices_last_24h: number; success_rate: number; cache_hit_rate: number; execution_time_distribution: string; gas_usage_distribution: string; steps_computed_distribution: string; memory_used_distribution: string; chain_distribution: string; task_type_distribution: string; last_updated: string } | undefined;

    if (!row) return null;

    // Parse JSON fields
    return {
      activeNodes: row.active_nodes,
      totalNodes: row.total_nodes,
      totalTasks: row.total_tasks,
      completedTasks: row.completed_tasks,
      failedTasks: row.failed_tasks,
      cachedTasks: row.cached_tasks,
      tasksLast24h: row.tasks_last_24h,
      totalInvoices: row.total_invoices,
      invoicesLast24h: row.invoices_last_24h,
      successRate: row.success_rate,
      cacheHitRate: row.cache_hit_rate,
      executionTimeDistribution: JSON.parse(row.execution_time_distribution || '{}'),
      gasUsageDistribution: JSON.parse(row.gas_usage_distribution || '{}'),
      stepsComputedDistribution: JSON.parse(row.steps_computed_distribution || '{}'),
      memoryUsedDistribution: JSON.parse(row.memory_used_distribution || '{}'),
      chainDistribution: JSON.parse(row.chain_distribution || '{}'),
      taskTypeDistribution: JSON.parse(row.task_type_distribution || '{}')
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed');
    }
  }
}

export default TruebitDatabase;
