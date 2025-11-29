# TrueBit Federation Aggregator

A standalone service that collects anonymized statistics from all TrueBit Monitor nodes via the NATS federation network and publishes aggregated network-wide statistics.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     NATS Server (f.tru.watch:9086)                  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  Federation Aggregator                        │  │
│  │                  (This Service)                               │  │
│  │                                                               │  │
│  │  Subscribes to:              Publishes:                       │  │
│  │  - truebit.tasks.received    - truebit.stats.aggregated      │  │
│  │  - truebit.tasks.completed                                    │  │
│  │  - truebit.invoices.created                                   │  │
│  │  - truebit.heartbeat                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  Node A       │         │  Node B       │         │  Node C       │
│  (tru.watch)  │         │  (AWS)        │         │  (Future)     │
│               │         │               │         │               │
│  Subscribes:  │         │  Subscribes:  │         │  Subscribes:  │
│  - stats.*    │         │  - stats.*    │         │  - stats.*    │
└───────────────┘         └───────────────┘         └───────────────┘
```

## Deployment

### Option 1: Docker Compose (Recommended)

Deploy on the same machine as your NATS server:

```bash
cd federation-aggregator

# Build and run
docker compose up -d

# View logs
docker compose logs -f
```

### Option 2: Manual Installation

```bash
cd federation-aggregator

# Install dependencies
npm install

# Set environment variables
export NATS_URL=wss://f.tru.watch:9086
export DB_PATH=/data/aggregator.db

# Run
npm start
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `NATS_URL` | `wss://f.tru.watch:9086` | NATS server URL |
| `DB_PATH` | `/data/aggregator.db` | SQLite database path |
| `PUBLISH_INTERVAL` | `30000` | Stats publish interval (ms) |
| `RETENTION_DAYS` | `30` | Data retention period |

## What It Does

1. **Collects Messages**: Subscribes to all `truebit.*` subjects
2. **Deduplicates**: Uses taskIdHash to avoid counting same task from multiple nodes
3. **Aggregates**: Computes network-wide totals every 30 seconds
4. **Publishes**: Sends aggregated stats to `truebit.stats.aggregated`
5. **Persists**: Stores history in SQLite for future analytics

## Published Statistics

Every 30 seconds, publishes to `truebit.stats.aggregated`:

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
    "totalInvoices": 1423,
    "invoicesLast24h": 142,
    "successRate": 98.2,
    "cacheHitRate": 22.1,
    "executionTimeDistribution": { ... },
    "gasUsageDistribution": { ... },
    "chainDistribution": { ... },
    "taskTypeDistribution": { ... }
  }
}
```

## Database Schema

The aggregator uses SQLite with the following tables:

- `aggregated_tasks` - Unique tasks across the network
- `aggregated_invoices` - Unique invoices across the network
- `active_nodes` - Nodes that sent heartbeats
- `network_stats_history` - Time-series of aggregated stats

## Deployment Checklist

1. [ ] NATS server is running at `wss://f.tru.watch:9086`
2. [ ] Deploy aggregator on same server as NATS (or with network access)
3. [ ] Update TrueBit Monitor nodes to subscribe to stats (already done in code)
4. [ ] Verify stats appear in Monitor UI under "Network" page
