# TrueBit Federation Aggregator

The Aggregator collects anonymized statistics from multiple Node Monitors and provides network-wide metrics like total online nodes and completed tasks.

## When Do You Need This?

**Most users don't need to run an aggregator.** The default aggregator at [tru.watch](https://tru.watch) (`f.tru.watch`) is available for all monitors to connect to.

Run your own aggregator if you:
- Want to create a private federation network
- Need to collect statistics for a specific group of nodes
- Want full control over the aggregation infrastructure

## Quick Start

### Prerequisites

- Docker 20.10 or higher
- A running NATS server (see `../nats/`)
- Public domain with TLS (for WebSocket connections from browsers)

### Deploy

```bash
cd aggregator
docker compose up -d
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Node Monitor   │────>│   NATS Server   │<────│  Node Monitor   │
│  (monitor/)     │     │   (nats/)       │     │  (monitor/)     │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Aggregator    │
                        │  (aggregator/)  │
                        └─────────────────┘
```

The aggregator:
1. Connects to a NATS server
2. Subscribes to federation messages from all monitors
3. Tracks online nodes and aggregates statistics
4. Publishes network-wide statistics back to NATS

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NATS_URL` | `nats://localhost:4222` | NATS server URL |
| `AGGREGATOR_ID` | (auto-generated) | Unique aggregator identifier |

### docker-compose.yml

```yaml
services:
  aggregator:
    build: .
    environment:
      - NATS_URL=nats://nats-server:4222
    depends_on:
      - nats
```

## Running with NATS

For a complete setup, you need both the NATS server and the aggregator:

```bash
# Start NATS server first
cd ../nats
docker compose up -d

# Then start the aggregator
cd ../aggregator
docker compose up -d
```

Or use the combined docker-compose in the root directory.

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run
npm start
```

## Monitors Connecting to Your Aggregator

Once your aggregator is running with a public URL, monitors can connect by setting:

```yaml
environment:
  - FEDERATION_NATS_URL=wss://your-aggregator-domain.com
```

Note: WebSocket connections from browsers require TLS (wss://), so you'll need to set up HTTPS for your NATS server.
