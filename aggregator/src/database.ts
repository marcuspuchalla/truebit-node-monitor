/**
 * Federation Aggregator Database
 * SQLite storage for aggregated network statistics
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

interface TaskData {
  taskIdHash: string | undefined;
  chainId?: string;
  taskType?: string;
}

interface TaskCompletedData {
  taskIdHash: string | undefined;
  status?: string;
  success?: boolean;
  executionTimeBucket?: string;
  gasUsedBucket?: string;
  cached?: boolean;
}

interface InvoiceData {
  invoiceIdHash: string | undefined;
  taskIdHash?: string;
  chainId?: string;
  stepsComputedBucket?: string;
  memoryUsedBucket?: string;
  operation?: string;
}

interface NodeData {
  nodeId: string;
  status?: string;
  totalTasksBucket?: string;
  activeTasksBucket?: string;
  continentBucket?: string;
  locationBucket?: string;
}

interface TaskCounts {
  total: number;
  completed: number;
  failed: number;
  cached: number;
}

interface InvoiceCounts {
  total: number;
  last24h: number;
}

export interface AggregatedStats {
  activeNodes: number;
  totalNodes: number;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  cachedTasks: number;
  tasksLast24h: number;
  totalInvoices: number;
  invoicesLast24h: number;
  successRate: number;
  cacheHitRate: number;
  executionTimeDistribution: Record<string, number>;
  gasUsageDistribution: Record<string, number>;
  stepsComputedDistribution: Record<string, number>;
  memoryUsedDistribution: Record<string, number>;
  chainDistribution: Record<string, number>;
  taskTypeDistribution: Record<string, number>;
  continentDistribution: Record<string, number>;
  locationDistribution: Record<string, number>;
}

class AggregatorDatabase {
  private dbPath: string;
  private db: DatabaseType | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    try {
      await mkdir(dirname(this.dbPath), { recursive: true });

      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');

      this.createTables();

      console.log(`Database initialized: ${this.dbPath}`);
    } catch (error) {
      console.error('Failed to initialize database:', (error as Error).message);
      throw error;
    }
  }

  private createTables(): void {
    if (!this.db) return;

    // Unique tasks seen across the network (deduplicated by taskIdHash)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS aggregated_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id_hash TEXT UNIQUE NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        chain_id TEXT,
        task_type TEXT,
        status TEXT DEFAULT 'received',
        success INTEGER,
        execution_time_bucket TEXT,
        gas_used_bucket TEXT,
        cached INTEGER,
        reporting_nodes INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Unique invoices seen across the network
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS aggregated_invoices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_id_hash TEXT UNIQUE NOT NULL,
        task_id_hash TEXT,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        chain_id TEXT,
        steps_computed_bucket TEXT,
        memory_used_bucket TEXT,
        operation TEXT,
        reporting_nodes INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Active nodes (from heartbeats)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS active_nodes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT UNIQUE NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        status TEXT DEFAULT 'online',
        total_tasks_bucket TEXT,
        active_tasks_bucket TEXT,
        continent_bucket TEXT,
        location_bucket TEXT,
        heartbeat_count INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add new columns if missing (migration for existing DBs)
    try {
      this.db.exec('ALTER TABLE active_nodes ADD COLUMN continent_bucket TEXT');
    } catch {
      // Column exists or migration not needed
    }
    try {
      this.db.exec('ALTER TABLE active_nodes ADD COLUMN location_bucket TEXT');
    } catch {
      // Column exists or migration not needed
    }

    // Time-series aggregates (stored every publish interval)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS network_stats_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at TEXT NOT NULL,
        active_nodes INTEGER,
        total_nodes INTEGER,
        total_tasks INTEGER,
        completed_tasks INTEGER,
        failed_tasks INTEGER,
        cached_tasks INTEGER,
        total_invoices INTEGER,
        success_rate REAL,
        cache_hit_rate REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // TRU token burns table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tru_burns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tx_hash TEXT NOT NULL,
        log_index INTEGER DEFAULT 0,
        block_number INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        amount_formatted REAL NOT NULL,
        burn_type TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tx_hash, log_index)
      )
    `);

    // Burn sync state table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tru_burn_sync_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_block INTEGER NOT NULL,
        total_burns INTEGER NOT NULL,
        last_sync TEXT NOT NULL
      )
    `);

    // Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_hash ON aggregated_tasks(task_id_hash);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON aggregated_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_first_seen ON aggregated_tasks(first_seen_at);
      CREATE INDEX IF NOT EXISTS idx_invoices_hash ON aggregated_invoices(invoice_id_hash);
      CREATE INDEX IF NOT EXISTS idx_invoices_task ON aggregated_invoices(task_id_hash);
      CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON active_nodes(last_seen_at);
      CREATE INDEX IF NOT EXISTS idx_stats_recorded ON network_stats_history(recorded_at);
      CREATE INDEX IF NOT EXISTS idx_burns_block ON tru_burns(block_number);
      CREATE INDEX IF NOT EXISTS idx_burns_timestamp ON tru_burns(timestamp);
    `);
  }

  // ===== TASKS =====

  upsertTask(data: TaskData): Database.RunResult | undefined {
    if (!this.db) return;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO aggregated_tasks (
        task_id_hash, first_seen_at, last_seen_at, chain_id, task_type, status
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(task_id_hash) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        reporting_nodes = reporting_nodes + 1
    `);

    return stmt.run(
      data.taskIdHash,
      now,
      now,
      data.chainId,
      data.taskType,
      'received'
    );
  }

  updateTaskCompleted(data: TaskCompletedData): Database.RunResult | undefined {
    if (!this.db) return;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE aggregated_tasks SET
        status = ?,
        success = ?,
        execution_time_bucket = ?,
        gas_used_bucket = ?,
        cached = ?,
        last_seen_at = ?
      WHERE task_id_hash = ?
    `);

    return stmt.run(
      data.status || 'completed',
      data.success ? 1 : 0,
      data.executionTimeBucket,
      data.gasUsedBucket,
      data.cached ? 1 : 0,
      now,
      data.taskIdHash
    );
  }

  // ===== INVOICES =====

  upsertInvoice(data: InvoiceData): Database.RunResult | undefined {
    if (!this.db) return;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO aggregated_invoices (
        invoice_id_hash, task_id_hash, first_seen_at, last_seen_at,
        chain_id, steps_computed_bucket, memory_used_bucket, operation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(invoice_id_hash) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        reporting_nodes = reporting_nodes + 1
    `);

    return stmt.run(
      data.invoiceIdHash,
      data.taskIdHash,
      now,
      now,
      data.chainId,
      data.stepsComputedBucket,
      data.memoryUsedBucket,
      data.operation
    );
  }

  // ===== NODES =====

  upsertNode(data: NodeData): Database.RunResult | undefined {
    if (!this.db) return;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO active_nodes (
        node_id, first_seen_at, last_seen_at, status, total_tasks_bucket, active_tasks_bucket, continent_bucket, location_bucket
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(node_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        status = excluded.status,
        total_tasks_bucket = excluded.total_tasks_bucket,
        active_tasks_bucket = excluded.active_tasks_bucket,
        continent_bucket = excluded.continent_bucket,
        location_bucket = excluded.location_bucket,
        heartbeat_count = heartbeat_count + 1
    `);

    return stmt.run(
      data.nodeId,
      now,
      now,
      data.status || 'online',
      data.totalTasksBucket,
      data.activeTasksBucket,
      data.continentBucket,
      data.locationBucket
    );
  }

  // ===== STATISTICS =====

  getActiveNodeCount(): number {
    if (!this.db) return 0;
    // Nodes with heartbeat in last 5 minutes
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM active_nodes
      WHERE last_seen_at > datetime('now', '-5 minutes')
    `);
    return (stmt.get() as { count: number }).count;
  }

  getTotalNodeCount(): number {
    if (!this.db) return 0;
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM active_nodes');
    return (stmt.get() as { count: number }).count;
  }

  getTaskCounts(): TaskCounts {
    if (!this.db) return { total: 0, completed: 0, failed: 0, cached: 0 };
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) as cached
      FROM aggregated_tasks
    `);
    return stmt.get() as TaskCounts;
  }

  getTasksLast24h(): number {
    if (!this.db) return 0;
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM aggregated_tasks
      WHERE first_seen_at > datetime('now', '-24 hours')
    `);
    return (stmt.get() as { count: number }).count;
  }

  getInvoiceCounts(): InvoiceCounts {
    if (!this.db) return { total: 0, last24h: 0 };
    const total = (this.db.prepare('SELECT COUNT(*) as count FROM aggregated_invoices').get() as { count: number }).count;
    const last24h = (this.db.prepare(`
      SELECT COUNT(*) as count FROM aggregated_invoices
      WHERE first_seen_at > datetime('now', '-24 hours')
    `).get() as { count: number }).count;

    return { total, last24h };
  }

  // Whitelist of allowed columns and tables to prevent SQL injection
  private static readonly ALLOWED_COLUMNS = new Set([
    'execution_time_bucket',
    'gas_used_bucket',
    'steps_computed_bucket',
    'memory_used_bucket',
    'chain_id',
    'task_type',
    'continent_bucket',
    'location_bucket'
  ]);

  private static readonly ALLOWED_TABLES = new Set([
    'aggregated_tasks',
    'aggregated_invoices',
    'active_nodes'
  ]);

  getDistribution(column: string, table = 'aggregated_tasks'): Record<string, number> {
    if (!this.db) return {};

    // Security: Validate column and table names against whitelist
    if (!AggregatorDatabase.ALLOWED_COLUMNS.has(column)) {
      console.error(`Security: Invalid column name rejected: ${column}`);
      return {};
    }
    if (!AggregatorDatabase.ALLOWED_TABLES.has(table)) {
      console.error(`Security: Invalid table name rejected: ${table}`);
      return {};
    }

    // Safe to use since we validated against whitelist
    const stmt = this.db.prepare(`
      SELECT ${column} as bucket, COUNT(*) as count
      FROM ${table}
      WHERE ${column} IS NOT NULL
      GROUP BY ${column}
    `);

    const rows = stmt.all() as Array<{ bucket: string; count: number }>;
    const distribution: Record<string, number> = {};
    for (const row of rows) {
      distribution[row.bucket] = row.count;
    }
    return distribution;
  }

  // Save stats snapshot for history
  saveStatsSnapshot(stats: AggregatedStats): Database.RunResult | undefined {
    if (!this.db) return;
    const stmt = this.db.prepare(`
      INSERT INTO network_stats_history (
        recorded_at, active_nodes, total_nodes, total_tasks, completed_tasks,
        failed_tasks, cached_tasks, total_invoices, success_rate, cache_hit_rate
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      new Date().toISOString(),
      stats.activeNodes,
      stats.totalNodes,
      stats.totalTasks,
      stats.completedTasks,
      stats.failedTasks,
      stats.cachedTasks,
      stats.totalInvoices,
      stats.successRate,
      stats.cacheHitRate
    );
  }

  // Compute all aggregated stats
  computeAggregatedStats(): AggregatedStats {
    const taskCounts = this.getTaskCounts();
    const invoiceCounts = this.getInvoiceCounts();
    const activeNodes = this.getActiveNodeCount();
    const totalNodes = this.getTotalNodeCount();
    const tasksLast24h = this.getTasksLast24h();

    const successRate = taskCounts.total > 0
      ? ((taskCounts.completed / taskCounts.total) * 100)
      : 0;

    const cacheHitRate = taskCounts.completed > 0
      ? ((taskCounts.cached / taskCounts.completed) * 100)
      : 0;

    return {
      activeNodes,
      totalNodes,
      totalTasks: taskCounts.total,
      completedTasks: taskCounts.completed,
      failedTasks: taskCounts.failed,
      cachedTasks: taskCounts.cached,
      tasksLast24h,
      totalInvoices: invoiceCounts.total,
      invoicesLast24h: invoiceCounts.last24h,
      successRate: Math.round(successRate * 10) / 10,
      cacheHitRate: Math.round(cacheHitRate * 10) / 10,
      executionTimeDistribution: this.getDistribution('execution_time_bucket'),
      gasUsageDistribution: this.getDistribution('gas_used_bucket'),
      stepsComputedDistribution: this.getDistribution('steps_computed_bucket', 'aggregated_invoices'),
      memoryUsedDistribution: this.getDistribution('memory_used_bucket', 'aggregated_invoices'),
      chainDistribution: this.getDistribution('chain_id'),
      taskTypeDistribution: this.getDistribution('task_type'),
      continentDistribution: this.getDistribution('continent_bucket', 'active_nodes'),
      locationDistribution: this.getDistribution('location_bucket', 'active_nodes')
    };
  }

  // ===== TRU BURNS =====

  insertBurns(burns: Array<{
    txHash: string;
    logIndex: number;
    blockNumber: number;
    timestamp: number;
    from: string;
    to: string;
    amount: string;
    amountFormatted: number;
    burnType: string;
  }>): number {
    if (!this.db || burns.length === 0) return 0;

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO tru_burns (
        tx_hash, log_index, block_number, timestamp, from_address, to_address,
        amount, amount_formatted, burn_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    const insertMany = this.db.transaction((items: typeof burns) => {
      for (const burn of items) {
        const result = stmt.run(
          burn.txHash,
          burn.logIndex,
          burn.blockNumber,
          burn.timestamp,
          burn.from,
          burn.to,
          burn.amount,
          burn.amountFormatted,
          burn.burnType
        );
        if (result.changes > 0) inserted++;
      }
    });

    insertMany(burns);
    return inserted;
  }

  getAllBurns(): Array<{
    txHash: string;
    logIndex: number;
    blockNumber: number;
    timestamp: number;
    from: string;
    to: string;
    amount: string;
    amountFormatted: number;
    burnType: string;
  }> {
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT tx_hash, log_index, block_number, timestamp, from_address,
             to_address, amount, amount_formatted, burn_type
      FROM tru_burns
      ORDER BY block_number ASC
    `);

    const rows = stmt.all() as Array<{
      tx_hash: string;
      log_index: number;
      block_number: number;
      timestamp: number;
      from_address: string;
      to_address: string;
      amount: string;
      amount_formatted: number;
      burn_type: string;
    }>;

    return rows.map(row => ({
      txHash: row.tx_hash,
      logIndex: row.log_index,
      blockNumber: row.block_number,
      timestamp: row.timestamp,
      from: row.from_address,
      to: row.to_address,
      amount: row.amount,
      amountFormatted: row.amount_formatted,
      burnType: row.burn_type
    }));
  }

  getBurnSyncState(): { lastBlock: number; totalBurns: number; lastSync: string | null } {
    if (!this.db) return { lastBlock: 0, totalBurns: 0, lastSync: null };

    const stmt = this.db.prepare('SELECT last_block, total_burns, last_sync FROM tru_burn_sync_state WHERE id = 1');
    const row = stmt.get() as { last_block: number; total_burns: number; last_sync: string } | undefined;

    if (row) {
      return {
        lastBlock: row.last_block,
        totalBurns: row.total_burns,
        lastSync: row.last_sync
      };
    }

    return { lastBlock: 0, totalBurns: 0, lastSync: null };
  }

  updateBurnSyncState(lastBlock: number, totalBurns: number): void {
    if (!this.db) return;

    const stmt = this.db.prepare(`
      INSERT INTO tru_burn_sync_state (id, last_block, total_burns, last_sync)
      VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        last_block = excluded.last_block,
        total_burns = excluded.total_burns,
        last_sync = excluded.last_sync
    `);

    stmt.run(lastBlock, totalBurns, new Date().toISOString());
  }

  // Cleanup old data
  cleanupOldData(days = 30): void {
    if (!this.db) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    this.db.prepare('DELETE FROM network_stats_history WHERE recorded_at < ?').run(cutoffStr);

    // Keep tasks and invoices for longer (90 days)
    const taskCutoff = new Date();
    taskCutoff.setDate(taskCutoff.getDate() - 90);
    const taskCutoffStr = taskCutoff.toISOString();

    this.db.prepare('DELETE FROM aggregated_tasks WHERE last_seen_at < ?').run(taskCutoffStr);
    this.db.prepare('DELETE FROM aggregated_invoices WHERE last_seen_at < ?').run(taskCutoffStr);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed');
    }
  }
}

export default AggregatorDatabase;
