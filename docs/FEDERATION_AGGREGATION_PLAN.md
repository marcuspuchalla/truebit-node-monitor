# Federation Aggregation System - Implementation Plan

## Overview

This document outlines the implementation plan for a centralized aggregation system that collects anonymized statistics from all TrueBit Monitor nodes via the NATS federation network and provides aggregated network-wide statistics back to each node.

## Current State

### What We Have
- **NATS Server**: Running at `wss://f.tru.watch`
- **Client Nodes**: Multiple TrueBit Monitor instances connecting as leaf nodes
- **Message Types**: `task_received`, `task_completed`, `heartbeat`
- **Anonymization**: SHA256 hashing, timestamp rounding, metrics bucketing
- **Local Storage**: SQLite databases on each node with tasks, invoices, federation messages

### TrueBit Node Data Sources (Inside Docker Container)

The TrueBit `runner-node` container has two primary data sources:

#### 1. EventDB (JSON File) - `/app/build/datadb/*-eventDB.json`
This is the **primary structured data source** already being read by `eventdb-reader.js`:

**Task Created Events:**
```json
{
  "type": "task_created",
  "executionId": "unique-task-id",
  "taskId": "0x...",
  "taskPath": "/path/to/task",
  "taskVersion": "1.0.0",
  "chainId": "1",
  "blockNumber": 12345678,
  "blockHash": "0x...",
  "taskRequesterAddress": "0x...",
  "senderAddress": "0x...",
  "input": { ... },
  "limits": { ... },
  "econParams": { ... },
  "signature": "0x...",
  "msgHash": "0x..."
}
```

**Computed Outcome Events:**
```json
{
  "type": "computed_outcome",
  "executionId": "unique-task-id",
  "senderAddress": "0x...",
  "encryptedSolution": "...",
  "signature": "0x...",
  "msgHash": "0x..."
}
```

**Invoice Events:**
```json
{
  "type": "invoice",
  "executionId": "unique-task-id",
  "taskId": "0x...",
  "invoiceId": "inv-123",
  "taskCreated_timeStamp": "2024-01-15T10:30:00.000Z",
  "stepGasPrice": "1000000000",
  "lineItem": [{
    "total_steps_computed": 500000,
    "peak_memory_used": 134217728,
    "account": "0x...",
    "operation": "compute"
  }],
  "accounting_signature": "0x..."
}
```

#### 2. Log Files - `/app/logs/@truebit/worker-runner-node-*/debug/`
- Current log: `*.log` (real-time tailing)
- Historical logs: `*.log.gz` (compressed archives)
- Parsed for task events, status updates, errors

### What's Missing
- **Central Aggregator**: No server-side component processing incoming messages
- **Aggregated Statistics**: No network-wide totals being computed
- **Stats Distribution**: No mechanism to push aggregated data back to nodes
- **Invoice Aggregation**: No network-wide invoice/earnings statistics

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          NATS Server (f.tru.watch)                      │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ truebit.    │  │ truebit.    │  │ truebit.    │  │ truebit.      │  │
│  │ tasks.      │  │ tasks.      │  │ heartbeat   │  │ stats.        │  │
│  │ received    │  │ completed   │  │             │  │ aggregated    │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────┬───────┘  │
│         │                │                │                  │          │
│         └────────────────┴────────────────┴──────────────────┘          │
│                                   │                                     │
│                    ┌──────────────┴──────────────┐                      │
│                    │     Federation Aggregator    │                      │
│                    │     (New Component)          │                      │
│                    │                              │                      │
│                    │  - Subscribe to all events   │                      │
│                    │  - Deduplicate by taskIdHash │                      │
│                    │  - Store in SQLite           │                      │
│                    │  - Compute aggregates        │                      │
│                    │  - Publish stats every 30s   │                      │
│                    └──────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│  Node A       │          │  Node B       │          │  Node C       │
│  (tru.watch)  │          │  (AWS)        │          │  (Future)     │
│               │          │               │          │               │
│  Publishes:   │          │  Publishes:   │          │  Publishes:   │
│  - tasks.*    │          │  - tasks.*    │          │  - tasks.*    │
│  - heartbeat  │          │  - heartbeat  │          │  - heartbeat  │
│               │          │               │          │               │
│  Subscribes:  │          │  Subscribes:  │          │  Subscribes:  │
│  - stats.*    │          │  - stats.*    │          │  - stats.*    │
└───────────────┘          └───────────────┘          └───────────────┘
```

## Components to Implement

### 1. Federation Aggregator Service (New - Server-Side)

A standalone Node.js service running alongside the NATS server that:

#### 1.1 Database Schema
```sql
-- Unique tasks seen across the network (deduplicated by taskIdHash)
CREATE TABLE aggregated_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id_hash TEXT UNIQUE NOT NULL,  -- SHA256 hash from client
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  chain_id TEXT,
  task_type TEXT,
  status TEXT,  -- 'received', 'completed', 'failed'
  success BOOLEAN,
  execution_time_bucket TEXT,
  gas_used_bucket TEXT,
  cached BOOLEAN,
  reporting_nodes INTEGER DEFAULT 1,  -- How many nodes reported this task
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Active nodes (from heartbeats)
CREATE TABLE active_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT UNIQUE NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  status TEXT DEFAULT 'online',
  total_tasks_bucket TEXT,
  active_tasks_bucket TEXT,
  heartbeat_count INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Time-series aggregates (computed every 30 seconds)
CREATE TABLE network_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recorded_at TEXT NOT NULL,
  stat_period TEXT NOT NULL,  -- '1h', '24h', '7d', 'all'

  -- Node metrics
  active_nodes INTEGER,
  total_nodes_seen INTEGER,

  -- Task metrics
  total_tasks INTEGER,
  completed_tasks INTEGER,
  failed_tasks INTEGER,
  cached_tasks INTEGER,

  -- Performance buckets (JSON)
  execution_time_distribution TEXT,  -- {"<100ms": 5, "100-500ms": 10, ...}
  gas_usage_distribution TEXT,       -- {"<100K": 3, "100K-1M": 7, ...}

  -- Chain distribution
  chain_distribution TEXT,           -- {"1": 50, "5": 30, ...}
  task_type_distribution TEXT,       -- {"wasm": 40, "docker": 20, ...}

  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Unique invoices seen across the network (deduplicated by invoiceIdHash)
CREATE TABLE aggregated_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id_hash TEXT UNIQUE NOT NULL,  -- SHA256 hash with federation salt
  task_id_hash TEXT,                      -- Links to aggregated_tasks
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  chain_id TEXT,
  steps_computed_bucket TEXT,             -- "<100K", "100K-1M", "1M-10M", "10M-100M", ">100M"
  memory_used_bucket TEXT,                -- "<64MB", "64-256MB", "256MB-1GB", ">1GB"
  operation TEXT,                         -- "compute", "solve", etc.
  reporting_nodes INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- API keys for aggregator authentication (Phase 1: simple keys)
CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key_hash TEXT UNIQUE NOT NULL,          -- SHA256 of the API key
  name TEXT NOT NULL,                      -- Descriptive name for the key
  node_id TEXT,                           -- Optional: tie key to specific node
  permissions TEXT DEFAULT 'publish',      -- 'publish', 'subscribe', 'admin'
  rate_limit INTEGER DEFAULT 60,          -- Messages per minute
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  is_active BOOLEAN DEFAULT 1
);

-- Indexes for performance
CREATE INDEX idx_tasks_hash ON aggregated_tasks(task_id_hash);
CREATE INDEX idx_tasks_status ON aggregated_tasks(status);
CREATE INDEX idx_tasks_first_seen ON aggregated_tasks(first_seen_at);
CREATE INDEX idx_invoices_hash ON aggregated_invoices(invoice_id_hash);
CREATE INDEX idx_invoices_task ON aggregated_invoices(task_id_hash);
CREATE INDEX idx_nodes_last_seen ON active_nodes(last_seen_at);
CREATE INDEX idx_stats_recorded ON network_stats(recorded_at);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

#### 1.2 Message Processing Logic
```javascript
// Pseudocode for aggregator
class FederationAggregator {
  async handleTaskReceived(msg) {
    const { taskIdHash, chainId, taskType } = msg.data;

    // Upsert task - first reporter wins for metadata
    await db.run(`
      INSERT INTO aggregated_tasks (task_id_hash, first_seen_at, last_seen_at, chain_id, task_type, status)
      VALUES (?, ?, ?, ?, ?, 'received')
      ON CONFLICT(task_id_hash) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        reporting_nodes = reporting_nodes + 1
    `, [taskIdHash, msg.timestamp, msg.timestamp, chainId, taskType]);
  }

  async handleTaskCompleted(msg) {
    const { taskIdHash, success, status, executionTimeBucket, gasUsedBucket, cached } = msg.data;

    await db.run(`
      UPDATE aggregated_tasks SET
        status = ?,
        success = ?,
        execution_time_bucket = ?,
        gas_used_bucket = ?,
        cached = ?,
        last_seen_at = ?
      WHERE task_id_hash = ?
    `, [status, success, executionTimeBucket, gasUsedBucket, cached, msg.timestamp, taskIdHash]);
  }

  async handleHeartbeat(msg) {
    const { nodeId, status, totalTasksBucket, activeTasksBucket } = msg;

    await db.run(`
      INSERT INTO active_nodes (node_id, first_seen_at, last_seen_at, status, total_tasks_bucket, active_tasks_bucket)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(node_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        status = excluded.status,
        total_tasks_bucket = excluded.total_tasks_bucket,
        active_tasks_bucket = excluded.active_tasks_bucket,
        heartbeat_count = heartbeat_count + 1
    `, [nodeId, msg.timestamp, msg.timestamp, status, totalTasksBucket, activeTasksBucket]);
  }

  async handleInvoiceCreated(msg) {
    const { invoiceIdHash, taskIdHash, chainId, stepsComputedBucket, memoryUsedBucket, operation } = msg.data;

    await db.run(`
      INSERT INTO aggregated_invoices (invoice_id_hash, task_id_hash, first_seen_at, last_seen_at, chain_id, steps_computed_bucket, memory_used_bucket, operation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(invoice_id_hash) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        reporting_nodes = reporting_nodes + 1
    `, [invoiceIdHash, taskIdHash, msg.timestamp, msg.timestamp, chainId, stepsComputedBucket, memoryUsedBucket, operation]);
  }
}
```

#### 1.3 Aggregation & Publishing
```javascript
// Run every 30 seconds
async function computeAndPublishStats() {
  const now = new Date().toISOString();

  // Compute aggregates
  const stats = {
    version: '1.0',
    type: 'network_stats',
    timestamp: now,
    data: {
      // Active nodes (heartbeat in last 5 minutes)
      activeNodes: await db.get(`
        SELECT COUNT(*) as count FROM active_nodes
        WHERE last_seen_at > datetime('now', '-5 minutes')
      `).count,

      // Total unique nodes ever seen
      totalNodes: await db.get(`
        SELECT COUNT(*) as count FROM active_nodes
      `).count,

      // Task counts
      totalTasks: await db.get(`SELECT COUNT(*) as count FROM aggregated_tasks`).count,
      completedTasks: await db.get(`SELECT COUNT(*) as count FROM aggregated_tasks WHERE status = 'completed'`).count,
      failedTasks: await db.get(`SELECT COUNT(*) as count FROM aggregated_tasks WHERE success = 0`).count,
      cachedTasks: await db.get(`SELECT COUNT(*) as count FROM aggregated_tasks WHERE cached = 1`).count,

      // Last 24 hours
      tasksLast24h: await db.get(`
        SELECT COUNT(*) as count FROM aggregated_tasks
        WHERE first_seen_at > datetime('now', '-24 hours')
      `).count,

      // Distributions
      executionTimeDistribution: await getDistribution('execution_time_bucket'),
      gasUsageDistribution: await getDistribution('gas_used_bucket'),
      chainDistribution: await getDistribution('chain_id'),
      taskTypeDistribution: await getDistribution('task_type'),

      // Invoice metrics
      totalInvoices: await db.get(`SELECT COUNT(*) as count FROM aggregated_invoices`).count,
      invoicesLast24h: await db.get(`
        SELECT COUNT(*) as count FROM aggregated_invoices
        WHERE first_seen_at > datetime('now', '-24 hours')
      `).count,
      stepsComputedDistribution: await getDistribution('steps_computed_bucket', 'aggregated_invoices'),
      memoryUsedDistribution: await getDistribution('memory_used_bucket', 'aggregated_invoices')
    }
  };

  // Store locally
  await db.run(`INSERT INTO network_stats (...) VALUES (...)`);

  // Publish to all subscribers
  await nats.publish('truebit.stats.aggregated', JSON.stringify(stats));
}
```

### 2. Client Updates (Existing Nodes)

#### 2.1 Subscribe to Aggregated Stats
```javascript
// In FederationClient.subscribeToFederation()
await this.subscribe('truebit.stats.aggregated', (data) => {
  // Store in local database
  db.updateNetworkStats(data);
  // Broadcast to WebSocket clients
  wsServer.broadcast('network_stats', data);
});
```

#### 2.2 New Database Table for Clients
```sql
CREATE TABLE IF NOT EXISTS network_stats_cache (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  -- Node metrics
  active_nodes INTEGER,
  total_nodes INTEGER,
  -- Task metrics
  total_tasks INTEGER,
  completed_tasks INTEGER,
  failed_tasks INTEGER,
  cached_tasks INTEGER,
  tasks_last_24h INTEGER,
  -- Invoice metrics
  total_invoices INTEGER,
  invoices_last_24h INTEGER,
  -- Distributions (JSON)
  execution_time_distribution TEXT,
  gas_usage_distribution TEXT,
  chain_distribution TEXT,
  task_type_distribution TEXT,
  steps_computed_distribution TEXT,
  memory_used_distribution TEXT,
  -- Metadata
  last_updated TEXT
);
```

#### 2.3 API Endpoint Updates
```javascript
// GET /api/federation/network-stats
router.get('/network-stats', (req, res) => {
  const stats = db.getNetworkStats();
  res.json(stats);
});
```

#### 2.4 Frontend Updates
```javascript
// In FederationView.vue
const networkStats = computed(() => federationStore.networkStats);

// Display:
// - {{ networkStats.activeNodes }} Active Nodes
// - {{ networkStats.totalTasks }} Total Tasks
// - {{ networkStats.completedTasks }} Completed
// - {{ networkStats.tasksLast24h }} Last 24h
```

### 3. Heartbeat Enhancement

Current heartbeat is not being sent regularly. Need to add:

```javascript
// In index.js, after federation connects
setInterval(async () => {
  if (federation.client?.isHealthy()) {
    const nodeStatus = db.getNodeStatus();
    const taskStats = db.getTaskStats();

    await federation.client.publishHeartbeat({
      status: nodeStatus?.registered ? 'online' : 'offline',
      activeTasks: activeTasks.size,
      totalTasks: taskStats.total
    });
  }
}, 60000); // Every minute
```

## Implementation Phases

### Phase 1: Aggregator Service (Server-Side)
**Location**: New repository or `/federation-aggregator` in this repo
**Effort**: 1-2 days

1. Create standalone Node.js service
2. Implement database schema
3. Subscribe to all `truebit.>` messages
4. Process and deduplicate messages
5. Compute aggregates every 30 seconds
6. Publish to `truebit.stats.aggregated`

### Phase 2: Client Updates
**Location**: This repository
**Effort**: 0.5-1 day

1. Subscribe to `truebit.stats.aggregated` in federation client
2. Add `network_stats_cache` table
3. Add `/api/federation/network-stats` endpoint
4. Update frontend to display network stats

### Phase 3: Heartbeat System
**Location**: This repository
**Effort**: 0.5 day

1. Implement periodic heartbeat publishing
2. Track active tasks count
3. Include node health metrics

### Phase 4: Enhanced Statistics
**Location**: Both
**Effort**: 1 day

1. Add time-series charts
2. Add distribution visualizations
3. Add historical comparisons

## Security Considerations

### Data Privacy
- **No Raw Data**: Aggregator only sees anonymized hashes and bucketed metrics
- **No IP Tracking**: NATS protocol doesn't expose client IPs to aggregator
- **Federation-Wide Salt**: All nodes use the same salt for hashing blockchain data (taskId, blockNumber, blockHash) enabling deduplication while preventing raw data exposure
- **Node-Specific Salt**: Node IDs are hashed with per-node salt for additional privacy

### Federation-Wide Salt for Deduplication
To enable cross-node deduplication without exposing raw blockchain data:
```javascript
// Salt is distributed via NATS on first connect
const FEDERATION_SALT = process.env.FEDERATION_SALT || 'default-salt-for-dev';

function hashForDeduplication(value) {
  return crypto.createHash('sha256')
    .update(FEDERATION_SALT + String(value))
    .digest('hex');
}

// All nodes use the same salt, so taskIdHash('0x123') produces the same hash
// enabling the aggregator to deduplicate without knowing the actual taskId
```

### Aggregator Security
- **Read-Only Design**: Aggregator doesn't send commands to nodes
- **Rate Limiting**: Already enforced by clients (60 msg/min)
- **Message Validation**: Validate message format before processing
- **API Key Authentication**: Simple API keys for Phase 1 (can upgrade to JWT later)

### Network Security
- **TLS Required**: All connections use WSS (TLS 1.3)
- **Authentication**: API keys for publish, open subscribe for stats

## Message Format Specification

### Published by Clients: `truebit.invoices.created`
```json
{
  "version": "1.0",
  "type": "invoice_created",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "nodeId": "abc123def456...",
  "data": {
    "invoiceIdHash": "sha256(federationSalt + invoiceId)",
    "taskIdHash": "sha256(federationSalt + taskId)",
    "chainId": "1",
    "stepsComputedBucket": "1M-10M",
    "memoryUsedBucket": "64-256MB",
    "operation": "compute"
  }
}
```

### Published by Aggregator: `truebit.stats.aggregated`
```json
{
  "version": "1.0",
  "type": "network_stats",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "activeNodes": 5,
    "totalNodes": 12,
    "totalTasks": 1547,
    "completedTasks": 1520,
    "failedTasks": 27,
    "cachedTasks": 342,
    "tasksLast24h": 156,
    "successRate": 98.2,
    "cacheHitRate": 22.1,
    "totalInvoices": 1423,
    "invoicesLast24h": 142,
    "executionTimeDistribution": {
      "<100ms": 450,
      "100-500ms": 620,
      "500ms-1s": 280,
      "1-5s": 150,
      "5-10s": 35,
      "10-30s": 10,
      "30s-1m": 2,
      ">1m": 0
    },
    "gasUsageDistribution": {
      "<100K": 200,
      "100K-1M": 800,
      "1M-10M": 400,
      "10M-100M": 120,
      ">100M": 27
    },
    "stepsComputedDistribution": {
      "<100K": 150,
      "100K-1M": 600,
      "1M-10M": 450,
      "10M-100M": 180,
      ">100M": 43
    },
    "memoryUsedDistribution": {
      "<64MB": 300,
      "64-256MB": 700,
      "256MB-1GB": 350,
      ">1GB": 73
    },
    "chainDistribution": {
      "1": 1200,
      "5": 300,
      "137": 47
    },
    "taskTypeDistribution": {
      "wasm": 1000,
      "docker": 500,
      "unknown": 47
    }
  }
}
```

## Deployment

### Aggregator Service
```yaml
# docker-compose.aggregator.yml
services:
  aggregator:
    build: ./federation-aggregator
    restart: unless-stopped
    environment:
      - NATS_URL=nats://localhost:4222
      - DB_PATH=/data/aggregator.db
      - PUBLISH_INTERVAL=30000
    volumes:
      - aggregator-data:/data
    networks:
      - nats-network
```

### NATS Server Configuration
No changes needed - aggregator connects as a regular client.

## Testing Plan

1. **Unit Tests**: Message parsing, aggregation logic
2. **Integration Tests**: NATS pub/sub, database operations
3. **Load Tests**: Simulate 100+ nodes sending messages
4. **Privacy Tests**: Verify no PII in aggregated data

## Rollout Strategy

1. Deploy aggregator alongside NATS server
2. Update one node to subscribe to stats
3. Verify stats are received correctly
4. Update remaining nodes
5. Monitor for issues

## Questions for Review

1. Should aggregator run as part of NATS container or separately?
2. What retention policy for historical stats? (7 days, 30 days, forever?)
3. Should we add authentication for the stats subscription?
4. Do we need invoice aggregation or just tasks?
