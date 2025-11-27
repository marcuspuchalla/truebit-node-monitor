# Federation Network Documentation

Complete documentation for the TrueBit Node Monitor Federation Network - a privacy-preserving, opt-in decentralized system for sharing anonymized task data across monitors.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [What is Federation?](#what-is-federation)
4. [Privacy & Security](#privacy--security)
5. [Installation & Configuration](#installation--configuration)
6. [Environment Variables](#environment-variables)
7. [API Reference](#api-reference)
8. [WebSocket Events](#websocket-events)
9. [Troubleshooting](#troubleshooting)
10. [Error Codes](#error-codes)
11. [FAQ](#faq)
12. [Architecture Diagrams](#architecture-diagrams)
13. [Security Hardening](#security-hardening)
14. [Advanced: Running Your Own Seed Server](#advanced-running-your-own-seed-server)

---

## Overview

The TrueBit Monitor Federation Network is an **opt-in** decentralized system that allows monitor nodes to share anonymized task data and network statistics with other participants. This creates a global view of TrueBit network activity while maintaining privacy and security.

### Design Principles

1. **Opt-In by Default**: Federation is disabled by default, explicit consent required
2. **Privacy First**: Only anonymized task metadata is shared
3. **Transparency**: Exactly what data is shared is clearly documented
4. **Simplicity**: One-liner installation, zero configuration required
5. **Reliability**: Local monitoring works even if federation fails
6. **Security**: No sensitive data ever transmitted

---

## Quick Start

### 30-Second Setup

```bash
# Enable federation with one command
ENABLE_FEDERATION=true docker compose -f docker-compose.monitor.yml up -d
```

**Done!** Your monitor is now part of the global network.

### Verify It's Working

```bash
# Check status
curl http://localhost:8090/api/federation/status | jq '.connected'
# Should return: true
```

### View the Dashboard

1. Open http://localhost:8090
2. Click "Network" tab
3. See global task activity from all nodes

---

## What is Federation?

### The Problem

Running a TrueBit node in isolation only shows tasks assigned to your specific node. You miss:
- Global network activity and trends
- Task volume across different chains
- Network health indicators
- Comparative performance metrics

### The Solution

Federation creates a **privacy-preserving peer-to-peer network** where monitors can:

**Share (Broadcast):**
- Anonymized task receipts (no private data)
- Task completion statistics
- Aggregated network metrics

**Receive (Subscribe):**
- Global task activity feed
- Network-wide statistics
- Health indicators from other nodes

---

## Privacy & Security

### Privacy Matrix

#### What IS Shared (Anonymized)
- Task chain ID (e.g., Ethereum, Arbitrum)
- Block number
- Task type (e.g., "wasm")
- Task status (received/completed/failed)
- Execution time (milliseconds)
- Timestamp
- Random node ID (UUID)

#### What is NEVER Shared
- Wallet address
- Private keys
- Task inputs/outputs
- IP address
- Log contents
- Invoice amounts
- Node identity (real)

### Security Boundaries

```
┌────────────────────────────────────────────────────┐
│ TrueBit Node Container                             │
│ ┌────────────────────────────────────┐            │
│ │ Private Keys (NEVER ACCESSED)      │            │
│ └────────────────────────────────────┘            │
└─────────────┬──────────────────────────────────────┘
              │ Read-Only Docker Socket
              ▼
┌────────────────────────────────────────────────────┐
│ Monitor Container                                  │
│ ┌────────────────────────────────────┐            │
│ │ Log Parser (extracts task metadata)│            │
│ └─────────────┬──────────────────────┘            │
│               ▼                                    │
│ ┌────────────────────────────────────┐            │
│ │ Anonymization Layer                │            │
│ │ • Strip execution IDs              │            │
│ │ • Remove wallet references         │            │
│ │ • Generate random node ID          │            │
│ └─────────────┬──────────────────────┘            │
│               ▼                                    │
│ ┌────────────────────────────────────┐            │
│ │ Federation Client (NATS)           │            │
│ └─────────────┬──────────────────────┘            │
└───────────────┼────────────────────────────────────┘
                │ Only Anonymized Data
                ▼
┌────────────────────────────────────────────────────┐
│ Federation Network (NATS)                          │
│ • No persistent storage                            │
│ • Pub/Sub only (ephemeral)                        │
│ • No message retention                             │
└────────────────────────────────────────────────────┘
```

### Threats Mitigated
- Private key exposure
- Wallet address leakage
- Task data theft
- Node operator deanonymization
- Man-in-the-middle attacks (with TLS)
- Message tampering

---

## Installation & Configuration

### Method 1: Docker Compose (Recommended)

```yaml
# docker-compose.monitor.yml
services:
  monitor:
    environment:
      # Enable federation with defaults
      - ENABLE_FEDERATION=true
```

Then start:
```bash
docker compose -f docker-compose.monitor.yml up -d
```

### Method 2: Environment Variable Override

```bash
ENABLE_FEDERATION=true docker compose -f docker-compose.monitor.yml up -d
```

### Method 3: Custom Configuration

```yaml
services:
  monitor:
    environment:
      - ENABLE_FEDERATION=true
      - FEDERATION_SEED_URL=nats://my-nats-server:4222
      - FEDERATION_NODE_ID=my-custom-node-id
      - FEDERATION_BROADCAST_TASKS=true
      - FEDERATION_BROADCAST_STATS=true
      - FEDERATION_RECEIVE_ENABLED=true
      - FEDERATION_TASK_RETENTION_DAYS=14
```

### Receive Only Mode (No Broadcasting)

```yaml
services:
  monitor:
    environment:
      - ENABLE_FEDERATION=true
      - FEDERATION_BROADCAST_TASKS=false
      - FEDERATION_BROADCAST_STATS=false
      - FEDERATION_RECEIVE_ENABLED=true
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_FEDERATION` | `false` | Enable/disable federation (opt-in) |
| `FEDERATION_SEED_URL` | `nats://federation.truebit.monitor:4222` | NATS seed server URL |
| `FEDERATION_NODE_ID` | (auto-generated) | Unique node identifier |
| `FEDERATION_BROADCAST_TASKS` | `true` | Broadcast task events to network |
| `FEDERATION_BROADCAST_STATS` | `true` | Broadcast statistics |
| `FEDERATION_RECEIVE_ENABLED` | `true` | Receive data from network |
| `FEDERATION_TASK_RETENTION_DAYS` | `7` | How long to keep global tasks locally |
| `FEDERATION_RECONNECT_TIMEOUT` | `5000` | Reconnection timeout (ms) |
| `FEDERATION_BROADCAST_INTERVAL_MS` | `1000` | Stats broadcast interval |
| `FEDERATION_TLS_ENABLED` | `false` | Use TLS for NATS connection |

---

## API Reference

### GET /api/federation/status

Get current federation status and statistics.

**Response:**
```json
{
  "enabled": true,
  "connected": true,
  "nodeId": "node-abc123",
  "stats": {
    "connectedPeers": 47,
    "tasks24h": 1247,
    "activeNodes": 47
  }
}
```

### GET /api/federation/tasks/global

Retrieve global task feed from the network.

**Query Parameters:**
- `limit` (number): Max tasks to return (default: 100)
- `chainId` (number): Filter by chain ID
- `since` (ISO timestamp): Get tasks after this time

**Response:**
```json
{
  "tasks": [
    {
      "taskId": "global-task-abc123",
      "chainId": 1,
      "blockNumber": 18950234,
      "taskType": "wasm",
      "status": "completed",
      "executionTimeMs": 245,
      "receivedAt": "2024-01-15T10:30:00Z",
      "sourceNode": "node-x7k2m9"
    }
  ],
  "total": 1247
}
```

### GET /api/federation/peers

List connected peer nodes (anonymized).

**Response:**
```json
{
  "peers": [
    {
      "nodeId": "node-x7k2m9",
      "region": "NA-EAST",
      "online": true,
      "tasksReported": 142
    }
  ],
  "total": 47
}
```

### POST /api/federation/settings

Update federation configuration (requires restart).

**Request Body:**
```json
{
  "enabled": true,
  "broadcastTasks": true,
  "broadcastStats": true,
  "receiveEnabled": true
}
```

---

## WebSocket Events

Subscribe to real-time federation updates via WebSocket at `ws://localhost:8090/ws`:

```javascript
const ws = new WebSocket('ws://localhost:8090/ws');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  switch (message.type) {
    case 'federation_task':
      // New global task received
      console.log('Global task:', message.data);
      break;

    case 'federation_stats':
      // Network statistics update
      console.log('Network stats:', message.data);
      break;

    case 'federation_status':
      // Connection status change
      console.log('Status:', message.data.connected ? 'Connected' : 'Disconnected');
      break;

    case 'federation_error':
      // Error occurred
      console.error('Federation error:', message.data);
      break;
  }
};
```

### Event Payloads

**federation_task:**
```json
{
  "type": "federation_task",
  "data": {
    "taskId": "global-task-abc123",
    "chainId": 1,
    "blockNumber": 18950234,
    "taskType": "wasm",
    "status": "completed",
    "executionTimeMs": 245,
    "sourceNode": "node-xyz789"
  }
}
```

**federation_stats:**
```json
{
  "type": "federation_stats",
  "data": {
    "activeNodes": 47,
    "tasks24h": 1247,
    "tasksCompleted24h": 1193,
    "avgExecutionMs": 234
  }
}
```

---

## Troubleshooting

### Diagnostic Commands

```bash
# Check federation status
curl http://localhost:8090/api/federation/status | jq

# View federation logs
docker logs truebit-node-monitor | grep -i federation

# Test seed server connectivity
telnet federation.truebit.monitor 4222

# DNS resolution
nslookup federation.truebit.monitor

# Database inspection
docker exec -it truebit-node-monitor sqlite3 /app/data/truebit-monitor.db \
  "SELECT COUNT(*) FROM federation_tasks;"
```

### Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| "Connection failed" | Network/firewall | Check port 4222 is open for outbound |
| "Connecting..." stuck | DNS/timeout | Check seed URL, increase timeout |
| Shows "Disabled" | Not enabled | Enable in settings or environment |
| No global tasks | Receive disabled | Enable "Receive global feed" setting |
| High memory usage | Too much data | Reduce `FEDERATION_TASK_RETENTION_DAYS` |

### Clear Federation Data

```bash
# Delete all global tasks
docker exec -it truebit-node-monitor sqlite3 /app/data/truebit-monitor.db \
  "DELETE FROM federation_tasks;"
```

---

## Error Codes

| Code | Issue | Quick Fix |
|------|-------|-----------|
| `FED_001` | Seed server unavailable | Check internet, verify URL |
| `FED_002` | Authentication failed | Check credentials |
| `FED_003` | Message validation failed | Update monitor version |
| `FED_004` | Rate limit exceeded | Reduce broadcast frequency |
| `FED_005` | Invalid node ID | Regenerate in settings |
| `FED_006` | Database error | Check disk space |
| `FED_007` | Network timeout | Check connection speed |
| `FED_008` | TLS certificate error | Update CA certificates |
| `FED_009` | Protocol version mismatch | Update monitor |
| `FED_010` | Subscription failed | Check NATS permissions |

---

## FAQ

### General Questions

**Q: Is federation enabled by default?**
A: No. Federation is **opt-in only**. You must explicitly enable it.

**Q: Can I use the monitor without federation?**
A: Yes! The monitor works perfectly in standalone mode.

**Q: Does federation cost money?**
A: No. The official seed server is provided free of charge.

**Q: Does it work behind a firewall?**
A: Yes. Only requires **outbound** connections on port 4222.

### Privacy Questions

**Q: Can someone trace tasks back to my wallet?**
A: No. Task data is anonymized and contains no identifying information.

**Q: Is my IP address shared?**
A: No. The NATS protocol doesn't expose client IP addresses to other peers.

**Q: Can I audit what data is being sent?**
A: Yes. Enable debug mode to see all outgoing messages in logs.

### Technical Questions

**Q: What protocol does federation use?**
A: NATS (https://nats.io), a lightweight cloud-native messaging system.

**Q: What if the seed server is down?**
A: Local monitoring continues normally. Federation reconnects automatically.

**Q: How much bandwidth does federation use?**
A: Minimal. Approximately 1-5 KB/s with moderate task activity.

---

## Architecture Diagrams

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Host Machine                                                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ TrueBit Runner Node                                  │   │
│  │   • Private Keys (NEVER ACCESSED)                   │   │
│  │   • EventDB  → READ ONLY                            │   │
│  │   • Log Files → READ ONLY                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ TrueBit Monitor                                      │   │
│  │   Log Parser → Anonymizer → Federation Client       │   │
│  │                                    ↓                 │   │
│  │                           Only anonymized data       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                                ↓
┌─────────────────────────────────────────────────────────────┐
│ NATS Federation Network                                      │
│   • Pub/Sub messaging (ephemeral)                           │
│   • No persistent storage                                    │
│   • TLS encryption available                                 │
└─────────────────────────────────────────────────────────────┘
```

### Network Topology

```
                    ┌─────────────────────────┐
                    │ NATS Seed Server        │
                    │ federation.truebit.     │
                    │ monitor:4222            │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 │               │               │
                 ▼               ▼               ▼
        ┌────────────┐  ┌────────────┐  ┌────────────┐
        │ Monitor A  │  │ Monitor B  │  │ Monitor C  │
        │ (NA-EAST)  │  │ (EU-WEST)  │  │ (ASIA)     │
        └────────────┘  └────────────┘  └────────────┘
```

### Data Flow

```
Your Monitor
    │
    ├─► Local TrueBit Node (read-only)
    │   └─► Tasks, Logs, Invoices
    │
    └─► Federation Network (opt-in)
        │
        ├─► Broadcast (if enabled)
        │   ├─► Anonymized task events
        │   └─► Aggregated statistics
        │
        └─► Receive (if enabled)
            ├─► Global task feed
            ├─► Network statistics
            └─► Peer information
```

### Connection State Machine

```
                    ┌──────────────┐
                    │   DISABLED   │  ← Default state
                    └──────┬───────┘
                           │
                   User enables
                           │
                           ▼
                    ┌──────────────┐
                    │  CONNECTING  │
                    └──────┬───────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
  ┌──────────────┐                   ┌──────────────┐
  │    ERROR     │                   │  CONNECTED   │
  └──────────────┘                   └──────┬───────┘
                                            │
                                    Connection lost
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │ RECONNECTING │
                                     └──────────────┘
```

---

## Security Hardening

### Production Checklist

- [ ] TLS certificates valid (not self-signed for production)
- [ ] All default passwords changed
- [ ] Rate limiting configured
- [ ] Monitoring and alerting set up
- [ ] Regular security audits scheduled
- [ ] Incident response plan documented

### Message Signing (Optional)

For enhanced security, messages can be signed with ECDSA:

```javascript
class MessageSigner {
  sign(message) {
    const payload = JSON.stringify(message);
    const signature = crypto.sign('sha256', Buffer.from(payload), this.privateKey);
    return {
      ...message,
      signature: signature.toString('base64'),
      publicKey: this.publicKey
    };
  }
}
```

### Compliance

**GDPR Compliance:**
- Right to erasure (delete federation data)
- Data minimization (only necessary data collected)
- Privacy by design (anonymization built-in)
- Transparency (user can see all shared data)
- Consent (opt-in federation)

---

## Advanced: Running Your Own Seed Server

For complete control over your federation network:

### Deploy NATS Server

```bash
docker run -d \
  --name nats-seed-server \
  -p 4222:4222 \
  -p 8222:8222 \
  nats:latest
```

### NATS Configuration

```conf
# nats-server.conf
listen: 0.0.0.0:4222
http_port: 8222

authorization {
  users = [
    {user: "monitor", password: "your-secure-password"}
  ]
}

debug: false
trace: false
logtime: true
```

### Point Monitors to Your Server

```bash
FEDERATION_SEED_URL=nats://monitor:password@your-server.com:4222 \
  docker compose -f docker-compose.monitor.yml up -d
```

### Monitor Server Health

```bash
# Via HTTP API
curl http://your-server.com:8222/varz

# View connections
curl http://your-server.com:8222/connz

# View subscriptions
curl http://your-server.com:8222/subsz
```

---

## Port Requirements

| Port | Protocol | Direction | Required | Purpose |
|------|----------|-----------|----------|---------|
| 4222 | TCP | Outbound | Yes | NATS messaging |
| 8222 | TCP | Outbound | No | NATS monitoring (optional) |

**Note:** No inbound ports required. Federation works behind NAT/firewall.

---

## Status Indicators

| Indicator | Status | Meaning |
|-----------|--------|---------|
| Connected | Healthy federation connection |
| Connecting | Attempting to connect |
| Error | Connection failed |
| Disabled | Federation is off |

---

## Performance Impact

| Metric | Standalone | With Federation | Impact |
|--------|------------|-----------------|--------|
| Memory | ~50 MB | ~60 MB | +20% |
| CPU | <1% | <2% | +1% |
| Bandwidth | 0 | 1-5 KB/s | Minimal |
| Disk I/O | Low | Low | Negligible |

---

## Example Message Format

### Task Event (Broadcasted)

```json
{
  "event": "task_completed",
  "nodeId": "node-a3f7c9d2e1",
  "chainId": 1,
  "blockNumber": 18950234,
  "taskType": "wasm",
  "executionTimeMs": 245,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Note: No wallet address, no execution ID, no task hash, no IP address.

---

## Conclusion

The TrueBit Monitor Federation Network provides a **privacy-preserving, opt-in** way to gain global visibility into TrueBit network activity while keeping your sensitive data completely private.

**Key Points:**
- Federation is always optional
- Only anonymized metadata is shared
- Your wallet and private keys are never accessed
- Local monitoring works independently
- You can opt-out at any time

---

**License:** MIT
