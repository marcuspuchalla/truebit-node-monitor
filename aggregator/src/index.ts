/**
 * TrueBit Federation Aggregator
 *
 * Collects anonymized statistics from all TrueBit Monitor nodes
 * and publishes aggregated network-wide statistics.
 *
 * Subscriptions:
 *   - truebit.tasks.received   - Task received events
 *   - truebit.tasks.completed  - Task completed events
 *   - truebit.invoices.created - Invoice created events
 *   - truebit.heartbeat        - Node heartbeat events
 *
 * Publishes:
 *   - truebit.stats.aggregated - Network-wide statistics (every 30s)
 */

import AggregatorDatabase from './database.js';
import AggregatorNatsClient from './nats-client.js';
import TruBurnMonitor, { type BurnStats } from './burn-monitor.js';

interface FederationMessage {
  nodeId?: string;
  data?: {
    taskIdHash?: string;
    chainId?: string;
    taskType?: string;
    status?: string;
    success?: boolean;
    executionTimeBucket?: string;
    gasUsedBucket?: string;
    cached?: boolean;
    invoiceIdHash?: string;
    stepsComputedBucket?: string;
    memoryUsedBucket?: string;
    operation?: string;
    totalTasksBucket?: string;
    activeTasksBucket?: string;
    continentBucket?: string;
    locationBucket?: string;
  };
}

// ===== INPUT VALIDATION (Minimal) =====
// Basic validation to prevent malformed data from being processed

const MAX_STRING_LENGTH = 256;
const HASH_PATTERN = /^[a-f0-9]{8,64}$/i;
const NODE_ID_PATTERN = /^node-[a-f0-9-]{36}$/i;
const BUCKET_PATTERN = /^[\d\-<>KMG]+$/;

function isValidString(value: unknown, maxLength = MAX_STRING_LENGTH): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function isValidHash(value: unknown): boolean {
  return isValidString(value, 64) && HASH_PATTERN.test(value as string);
}

function isValidNodeId(value: unknown): boolean {
  return isValidString(value, 50) && NODE_ID_PATTERN.test(value as string);
}

function isValidBucket(value: unknown): boolean {
  return isValidString(value, 20) && BUCKET_PATTERN.test(value as string);
}

function isValidLocationBucket(value: unknown): boolean {
  if (!isValidString(value, 32)) return false;
  const parts = (value as string).split(',');
  if (parts.length !== 2) return false;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
}

function validateMessage(data: unknown, requiredFields: string[] = []): data is FederationMessage {
  if (!data || typeof data !== 'object') {
    console.warn('[VALIDATION] Message is not an object');
    return false;
  }

  const msg = data as Record<string, unknown>;

  // Validate nodeId if present
  if (msg.nodeId !== undefined && !isValidNodeId(msg.nodeId)) {
    console.warn('[VALIDATION] Invalid nodeId format');
    return false;
  }

  // Validate data object if present
  if (msg.data !== undefined) {
    if (typeof msg.data !== 'object' || msg.data === null) {
      console.warn('[VALIDATION] Invalid data field');
      return false;
    }

    const dataObj = msg.data as Record<string, unknown>;

    // Validate hashes
    if (dataObj.taskIdHash !== undefined && !isValidHash(dataObj.taskIdHash)) {
      console.warn('[VALIDATION] Invalid taskIdHash');
      return false;
    }
    if (dataObj.invoiceIdHash !== undefined && !isValidHash(dataObj.invoiceIdHash)) {
      console.warn('[VALIDATION] Invalid invoiceIdHash');
      return false;
    }

    // Validate buckets
    const bucketFields = ['executionTimeBucket', 'gasUsedBucket', 'stepsComputedBucket',
                          'memoryUsedBucket', 'totalTasksBucket', 'activeTasksBucket'];
    for (const field of bucketFields) {
      if (dataObj[field] !== undefined && !isValidBucket(dataObj[field])) {
        console.warn(`[VALIDATION] Invalid ${field}`);
        return false;
      }
    }

    // Validate strings
    const stringFields = ['chainId', 'taskType', 'status', 'operation', 'continentBucket'];
    for (const field of stringFields) {
      if (dataObj[field] !== undefined && !isValidString(dataObj[field], 64)) {
        console.warn(`[VALIDATION] Invalid ${field}`);
        return false;
      }
    }

    if (dataObj.locationBucket !== undefined && !isValidLocationBucket(dataObj.locationBucket)) {
      console.warn('[VALIDATION] Invalid locationBucket');
      return false;
    }
  }

  return true;
}

// Configuration
const config = {
  natsUrl: process.env.NATS_URL || 'wss://f.tru.watch',
  // NATS Authentication (user/password)
  natsUser: process.env.NATS_USER || 'aggregator',
  natsPassword: process.env.NATS_AGGREGATOR_PASSWORD || '', // REQUIRED for production!
  dbPath: process.env.DB_PATH || '/data/aggregator.db',
  publishInterval: parseInt(process.env.PUBLISH_INTERVAL || '30000', 10), // 30 seconds
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '86400000', 10), // 24 hours
  retentionDays: parseInt(process.env.RETENTION_DAYS || '30', 10),
  rateLimitPerNode: parseInt(process.env.RATE_LIMIT_PER_NODE || '10', 10), // Messages per second per node
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '1000', 10) // 1 second window
};

// ===== RATE LIMITING =====
// Track message counts per node to prevent flooding
const nodeMessageCounts = new Map<string, { count: number; windowStart: number }>();

// SECURITY: Global rate limit to prevent anonymous message flooding (F-006)
let globalMessageCount = { count: 0, windowStart: Date.now() };
const GLOBAL_RATE_LIMIT = parseInt(process.env.GLOBAL_RATE_LIMIT || '1000', 10);

/**
 * SECURITY: Rate limiting with global fallback
 * F-006 FIX: Messages without nodeId are now rejected (changed from false to true)
 */
function isRateLimited(nodeId: string | undefined): boolean {
  const now = Date.now();

  // Global rate limit check (all messages)
  if (now - globalMessageCount.windowStart >= config.rateLimitWindow) {
    globalMessageCount = { count: 1, windowStart: now };
  } else {
    globalMessageCount.count++;
    if (globalMessageCount.count > GLOBAL_RATE_LIMIT) {
      console.error('[SECURITY] Global rate limit exceeded');
      return true;
    }
  }

  // CRITICAL FIX (F-006): Reject messages without nodeId
  // Previously returned false, allowing unlimited anonymous messages
  if (!nodeId) {
    console.warn('[SECURITY] Rejecting message without nodeId');
    return true;
  }

  const entry = nodeMessageCounts.get(nodeId);

  if (!entry || now - entry.windowStart >= config.rateLimitWindow) {
    // New window or first message
    nodeMessageCounts.set(nodeId, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;

  if (entry.count > config.rateLimitPerNode) {
    console.warn(`[SECURITY] Rate limit exceeded for node ${nodeId.slice(0, 12)}... (${entry.count} msgs/s)`);
    return true;
  }

  return false;
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [nodeId, entry] of nodeMessageCounts.entries()) {
    if (now - entry.windowStart > config.rateLimitWindow * 10) {
      nodeMessageCounts.delete(nodeId);
    }
  }
}, 60000); // Cleanup every minute

// Global instances
let db: AggregatorDatabase;
let nats: AggregatorNatsClient;
let burnMonitor: TruBurnMonitor;
let publishTimer: ReturnType<typeof setInterval>;
let cleanupTimer: ReturnType<typeof setInterval>;

// Cached burn stats (updated on each publish interval)
let cachedBurnStats: BurnStats | null = null;

// Message handlers
function handleTaskReceived(data: unknown, _subject: string): void {
  // SECURITY: Validate message structure BEFORE rate limiting (per review feedback)
  // This prevents malformed data from affecting rate limiter state
  if (!validateMessage(data)) {
    return;
  }

  const msg = data as FederationMessage;

  // Rate limit check (now rejects messages without nodeId)
  if (isRateLimited(msg.nodeId)) {
    return;
  }

  try {
    console.log(`Task received: ${msg.data?.taskIdHash?.slice(0, 12)}...`);

    db.upsertTask({
      taskIdHash: msg.data?.taskIdHash,
      chainId: msg.data?.chainId,
      taskType: msg.data?.taskType
    });
  } catch (error) {
    console.error('Error handling task received:', (error as Error).message);
  }
}

function handleTaskCompleted(data: unknown, _subject: string): void {
  // SECURITY: Validate message structure BEFORE rate limiting
  if (!validateMessage(data)) {
    return;
  }

  const msg = data as FederationMessage;

  // Rate limit check (now rejects messages without nodeId)
  if (isRateLimited(msg.nodeId)) {
    return;
  }

  try {
    console.log(`Task completed: ${msg.data?.taskIdHash?.slice(0, 12)}...`);

    db.updateTaskCompleted({
      taskIdHash: msg.data?.taskIdHash,
      status: msg.data?.status || 'completed',
      success: msg.data?.success,
      executionTimeBucket: msg.data?.executionTimeBucket,
      gasUsedBucket: msg.data?.gasUsedBucket,
      cached: msg.data?.cached
    });
  } catch (error) {
    console.error('Error handling task completed:', (error as Error).message);
  }
}

function handleInvoiceCreated(data: unknown, _subject: string): void {
  // SECURITY: Validate message structure BEFORE rate limiting
  if (!validateMessage(data)) {
    return;
  }

  const msg = data as FederationMessage;

  // Rate limit check (now rejects messages without nodeId)
  if (isRateLimited(msg.nodeId)) {
    return;
  }

  try {
    console.log(`Invoice created: ${msg.data?.invoiceIdHash?.slice(0, 12)}...`);

    db.upsertInvoice({
      invoiceIdHash: msg.data?.invoiceIdHash,
      taskIdHash: msg.data?.taskIdHash,
      chainId: msg.data?.chainId,
      stepsComputedBucket: msg.data?.stepsComputedBucket,
      memoryUsedBucket: msg.data?.memoryUsedBucket,
      operation: msg.data?.operation
    });
  } catch (error) {
    console.error('Error handling invoice created:', (error as Error).message);
  }
}

function handleHeartbeat(data: unknown, _subject: string): void {
  // SECURITY: Validate message structure BEFORE rate limiting
  if (!validateMessage(data)) {
    return;
  }

  const msg = data as FederationMessage;

  // Rate limit check (now rejects messages without nodeId)
  if (isRateLimited(msg.nodeId)) {
    return;
  }

  try {
    const nodeId = msg.nodeId?.slice(0, 12) || 'unknown';
    console.log(`Heartbeat from: ${nodeId}...`);

    // Heartbeat data is nested inside data.data from the anonymizer
    db.upsertNode({
      nodeId: msg.nodeId || 'unknown',
      status: (msg.data as { status?: string })?.status || 'online',
      totalTasksBucket: msg.data?.totalTasksBucket,
      activeTasksBucket: msg.data?.activeTasksBucket,
      continentBucket: msg.data?.continentBucket,
      locationBucket: msg.data?.locationBucket
    });
  } catch (error) {
    console.error('Error handling heartbeat:', (error as Error).message);
  }
}

// Publish aggregated stats
async function publishAggregatedStats(): Promise<void> {
  try {
    const stats = db.computeAggregatedStats();

    // Get latest burn stats
    if (burnMonitor) {
      cachedBurnStats = burnMonitor.getStats();
    }

    const message = {
      version: '1.0',
      type: 'network_stats',
      timestamp: new Date().toISOString(),
      data: {
        ...stats,
        // Include TRU token burn statistics
        truBurns: cachedBurnStats ? {
          totalBurned: cachedBurnStats.totalBurnedFormatted,
          burnCount: cachedBurnStats.burnCount,
          last24hBurned: cachedBurnStats.last24hBurned,
          last7dBurned: cachedBurnStats.last7dBurned,
          lastBurnTimestamp: cachedBurnStats.lastBurnTimestamp,
          lastBurnTxHash: cachedBurnStats.lastBurnTxHash
        } : null
      }
    };

    await nats.publish('truebit.stats.aggregated', message);

    // Save snapshot for history
    db.saveStatsSnapshot(stats);

    const burnInfo = cachedBurnStats ? `, ${cachedBurnStats.burnCount} burns (${Math.round(cachedBurnStats.totalBurnedFormatted).toLocaleString()} TRU)` : '';
    console.log(`Published stats: ${stats.activeNodes} nodes, ${stats.totalTasks} tasks, ${stats.totalInvoices} invoices${burnInfo}`);
  } catch (error) {
    console.error('Error publishing stats:', (error as Error).message);
  }
}

// Cleanup old data
function runCleanup(): void {
  try {
    console.log('Running cleanup...');
    db.cleanupOldData(config.retentionDays);
    console.log('Cleanup complete');
  } catch (error) {
    console.error('Cleanup error:', (error as Error).message);
  }
}

// Graceful shutdown
async function shutdown(): Promise<void> {
  console.log('Shutting down...');

  if (publishTimer) {
    clearInterval(publishTimer);
  }

  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  if (burnMonitor) {
    burnMonitor.stop();
  }

  if (nats) {
    await nats.disconnect();
  }

  if (db) {
    db.close();
  }

  process.exit(0);
}

// Main
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('TrueBit Federation Aggregator');
  console.log('='.repeat(60));
  console.log(`NATS URL: ${config.natsUrl}`);
  console.log(`Database: ${config.dbPath}`);
  console.log(`Publish interval: ${config.publishInterval}ms`);
  console.log('='.repeat(60));

  // Initialize database
  db = new AggregatorDatabase(config.dbPath);
  await db.initialize();

  // Initialize TRU burn monitor with database persistence
  console.log('Initializing TRU burn monitor...');
  burnMonitor = new TruBurnMonitor();
  try {
    // Load cached burns from database
    const cachedBurns = db.getAllBurns();
    const syncState = db.getBurnSyncState();

    if (cachedBurns.length > 0) {
      console.log(`[BurnMonitor] Loading ${cachedBurns.length} burns from database (last block: ${syncState.lastBlock})`);
      burnMonitor.importFromPersistence(
        cachedBurns.map(b => ({
          txHash: b.txHash,
          blockNumber: b.blockNumber,
          logIndex: b.logIndex,
          timestamp: b.timestamp,
          from: b.from,
          to: b.to,
          amount: b.amount,
          amountFormatted: b.amountFormatted,
          burnType: b.burnType as 'null' | 'dead'
        })),
        syncState.lastBlock
      );
    }

    // Sync any new burns since last sync
    await burnMonitor.initialize();

    // Start periodic sync (every 5 minutes)
    burnMonitor.start(300000);

    // Log and persist new burns as they're detected
    burnMonitor.on('burn', (burn) => {
      console.log(`[BurnMonitor] New burn detected: ${burn.amountFormatted.toFixed(2)} TRU from ${burn.from.slice(0, 10)}...`);
      // Persist to database
      db.insertBurns([burn]);
      const exported = burnMonitor.exportForPersistence();
      db.updateBurnSyncState(exported.lastBlock, exported.burns.length);
    });

    // Persist initial sync to database
    const exported = burnMonitor.exportForPersistence();
    if (exported.burns.length > cachedBurns.length) {
      const newBurns = exported.burns.slice(cachedBurns.length);
      const inserted = db.insertBurns(newBurns);
      db.updateBurnSyncState(exported.lastBlock, exported.burns.length);
      console.log(`[BurnMonitor] Persisted ${inserted} new burns to database`);
    }

    console.log('TRU burn monitor active');
  } catch (error) {
    console.error('Failed to initialize burn monitor:', (error as Error).message);
    // Continue without burn monitoring - it's not critical
  }

  // Initialize NATS client
  nats = new AggregatorNatsClient({
    servers: [config.natsUrl],
    user: config.natsUser,
    pass: config.natsPassword || undefined
  });

  const connected = await nats.connect();
  if (!connected) {
    console.error('Failed to connect to NATS. Exiting.');
    process.exit(1);
  }

  // Subscribe to all federation messages
  console.log('Setting up subscriptions...');

  await nats.subscribe('truebit.tasks.received', handleTaskReceived);
  await nats.subscribe('truebit.tasks.completed', handleTaskCompleted);
  await nats.subscribe('truebit.invoices.created', handleInvoiceCreated);
  await nats.subscribe('truebit.heartbeat', handleHeartbeat);

  console.log('Subscriptions active');

  // Start publishing timer
  publishTimer = setInterval(publishAggregatedStats, config.publishInterval);
  console.log(`Publishing stats every ${config.publishInterval / 1000}s`);

  // Start cleanup timer
  cleanupTimer = setInterval(runCleanup, config.cleanupInterval);

  // Publish initial stats
  await publishAggregatedStats();

  // Handle shutdown signals
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('Federation Aggregator is running');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
