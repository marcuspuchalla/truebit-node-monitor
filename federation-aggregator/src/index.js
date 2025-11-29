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

// Configuration
const config = {
  natsUrl: process.env.NATS_URL || 'wss://f.tru.watch:9086',
  dbPath: process.env.DB_PATH || '/data/aggregator.db',
  publishInterval: parseInt(process.env.PUBLISH_INTERVAL || '30000', 10), // 30 seconds
  cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL || '86400000', 10), // 24 hours
  retentionDays: parseInt(process.env.RETENTION_DAYS || '30', 10)
};

// Global instances
let db;
let nats;
let publishTimer;
let cleanupTimer;

// Message handlers
function handleTaskReceived(data, subject) {
  try {
    console.log(`Task received: ${data.data?.taskIdHash?.slice(0, 12)}...`);

    db.upsertTask({
      taskIdHash: data.data?.taskIdHash,
      chainId: data.data?.chainId,
      taskType: data.data?.taskType
    });
  } catch (error) {
    console.error('Error handling task received:', error.message);
  }
}

function handleTaskCompleted(data, subject) {
  try {
    console.log(`Task completed: ${data.data?.taskIdHash?.slice(0, 12)}...`);

    db.updateTaskCompleted({
      taskIdHash: data.data?.taskIdHash,
      status: data.data?.status || 'completed',
      success: data.data?.success,
      executionTimeBucket: data.data?.executionTimeBucket,
      gasUsedBucket: data.data?.gasUsedBucket,
      cached: data.data?.cached
    });
  } catch (error) {
    console.error('Error handling task completed:', error.message);
  }
}

function handleInvoiceCreated(data, subject) {
  try {
    console.log(`Invoice created: ${data.data?.invoiceIdHash?.slice(0, 12)}...`);

    db.upsertInvoice({
      invoiceIdHash: data.data?.invoiceIdHash,
      taskIdHash: data.data?.taskIdHash,
      chainId: data.data?.chainId,
      stepsComputedBucket: data.data?.stepsComputedBucket,
      memoryUsedBucket: data.data?.memoryUsedBucket,
      operation: data.data?.operation
    });
  } catch (error) {
    console.error('Error handling invoice created:', error.message);
  }
}

function handleHeartbeat(data, subject) {
  try {
    const nodeId = data.nodeId?.slice(0, 12) || 'unknown';
    console.log(`Heartbeat from: ${nodeId}...`);

    db.upsertNode({
      nodeId: data.nodeId,
      status: data.status || 'online',
      totalTasksBucket: data.totalTasksBucket,
      activeTasksBucket: data.activeTasksBucket
    });
  } catch (error) {
    console.error('Error handling heartbeat:', error.message);
  }
}

// Publish aggregated stats
async function publishAggregatedStats() {
  try {
    const stats = db.computeAggregatedStats();

    const message = {
      version: '1.0',
      type: 'network_stats',
      timestamp: new Date().toISOString(),
      data: stats
    };

    await nats.publish('truebit.stats.aggregated', message);

    // Save snapshot for history
    db.saveStatsSnapshot(stats);

    console.log(`Published stats: ${stats.activeNodes} nodes, ${stats.totalTasks} tasks, ${stats.totalInvoices} invoices`);
  } catch (error) {
    console.error('Error publishing stats:', error.message);
  }
}

// Cleanup old data
function runCleanup() {
  try {
    console.log('Running cleanup...');
    db.cleanupOldData(config.retentionDays);
    console.log('Cleanup complete');
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down...');

  if (publishTimer) {
    clearInterval(publishTimer);
  }

  if (cleanupTimer) {
    clearInterval(cleanupTimer);
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
async function main() {
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

  // Initialize NATS client
  nats = new AggregatorNatsClient({
    servers: [config.natsUrl]
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
