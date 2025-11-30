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
        heartbeat_count INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    // Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_hash ON aggregated_tasks(task_id_hash);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON aggregated_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_first_seen ON aggregated_tasks(first_seen_at);
      CREATE INDEX IF NOT EXISTS idx_invoices_hash ON aggregated_invoices(invoice_id_hash);
      CREATE INDEX IF NOT EXISTS idx_invoices_task ON aggregated_invoices(task_id_hash);
      CREATE INDEX IF NOT EXISTS idx_nodes_last_seen ON active_nodes(last_seen_at);
      CREATE INDEX IF NOT EXISTS idx_stats_recorded ON network_stats_history(recorded_at);
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
        node_id, first_seen_at, last_seen_at, status, total_tasks_bucket, active_tasks_bucket
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(node_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        status = excluded.status,
        total_tasks_bucket = excluded.total_tasks_bucket,
        active_tasks_bucket = excluded.active_tasks_bucket,
        heartbeat_count = heartbeat_count + 1
    `);

    return stmt.run(
      data.nodeId,
      now,
      now,
      data.status || 'online',
      data.totalTasksBucket,
      data.activeTasksBucket
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

  getDistribution(column: string, table = 'aggregated_tasks'): Record<string, number> {
    if (!this.db) return {};
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
      taskTypeDistribution: this.getDistribution('task_type')
    };
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
