# TrueBit Node Monitor

A privacy-first, decentralized monitoring solution for TrueBit computation nodes.

---

## IMPORTANT DISCLAIMER

**USE AT YOUR OWN RISK**: This software is provided "as is" without any warranties or guarantees of any kind, either express or implied. The authors and contributors are not responsible for any damages, losses, or issues that may arise from using this software.

**NOT AFFILIATED WITH TRUEBIT**: This project is an independent, community-developed monitoring tool and is **NOT** officially associated with, endorsed by, or affiliated with TrueBit Foundation, TrueBit Company, or any official TrueBit entities. TrueBit is a trademark of its respective owners.

By using this software, you acknowledge that:
- You use it entirely at your own risk
- The software may contain bugs, errors, or security vulnerabilities
- No guarantees are made regarding accuracy, reliability, or fitness for any purpose
- You are solely responsible for securing your infrastructure and private keys
- The authors assume no liability for any financial losses or damages

---

## Features

- **Real-time Monitoring**: Track TrueBit node activity, tasks, and invoices
- **Privacy-First Federation**: Optional participation in global monitoring network with guaranteed privacy
- **Docker-Based**: Easy deployment with Docker Compose

## Privacy Guarantees

### Absolute Guarantees (Cryptographically Enforced)

| Guarantee | Implementation | Verification |
|-----------|---------------|--------------|
| **Wallet Address Never Transmitted** | Privacy validator blocks any data matching wallet pattern | Check `backend/src/utils/privacy-validator.ts` |
| **Private Keys Inaccessible** | Docker socket mounted read-only, secrets directory not mounted | Check Docker compose volumes |
| **Task Input/Output Local-Only** | Input/output data stripped before federation transmission | Check `backend/src/federation/anonymizer.ts` |
| **IP Address Hidden** | NATS leaf node protocol - peers see server IP, not yours | Architecture design |

### Strong Guarantees (Defense in Depth)

| Guarantee | Implementation |
|-----------|---------------|
| **SHA256 Anonymization** | All identifiers hashed with per-node salt before transmission |
| **Metric Bucketing** | Values bucketed into 5-8 ranges to prevent fingerprinting (e.g., "1-10", "10-50") |
| **Timestamp Rounding** | Timestamps rounded to 5-minute intervals to prevent timing correlation |
| **Random Node ID** | UUID generated per installation, no hardware fingerprinting |
| **Opt-in Federation** | Federation disabled by default, explicit user action required |

### What Data IS Shared (When Federation Enabled)

- Hashed task identifiers (not original IDs)
- Task type categories (e.g., "wasm", "docker")
- Bucketed metrics (execution time ranges, gas usage ranges)
- Node status (online/offline)
- Anonymized statistics for network-wide aggregation

### What Data is NEVER Shared

- Wallet addresses
- Private keys
- Task input/output data
- Your IP address
- Exact metric values
- Container logs content
- Any data that could identify your node or link to your wallet

---

## System Components

The TrueBit Node Monitor consists of three main components:

| Component | Description | When to Use |
|-----------|-------------|-------------|
| **Monitor** | Main monitoring application (backend + frontend) | Always required |
| **NATS Server** | Message broker for federation | Only if hosting federation infrastructure |
| **Aggregator** | Collects and aggregates network statistics | Only for central federation hub |

---

## Deployment Guide

Choose the deployment option that matches your setup:

### Option 1: Standalone (Direct Docker)

**Best for**: Running on the same machine as your TrueBit node without a reverse proxy.

```bash
# Clone the repository
git clone https://github.com/marcuspuchalla/truebit-node-monitor.git
cd truebit-node-monitor

# Start the monitor
docker compose -f docker-compose.standalone.yml up -d

# Access the dashboard
open http://localhost:8090
```

**Requirements:**
- Docker and Docker Compose
- TrueBit node running (`runner-node` container)
- Port 8090 available

**File**: `docker-compose.standalone.yml`

---

### Option 2: With HTTPS (Traefik + Let's Encrypt)

**Best for**: Public-facing deployment with automatic SSL certificates.

```bash
# Clone the repository
git clone https://github.com/marcuspuchalla/truebit-node-monitor.git
cd truebit-node-monitor

# Create environment file
cp .env.example .env

# Edit .env and set your domain and email
# DOMAIN=monitor.yourdomain.com
# ACME_EMAIL=your-email@example.com

# Start with HTTPS
docker compose -f docker-compose.https.yml up -d

# Access the dashboard
open https://monitor.yourdomain.com
```

**Requirements:**
- Docker and Docker Compose
- Domain name pointing to your server
- Ports 80 and 443 available

**File**: `docker-compose.https.yml`

---

### Option 3: Coolify Deployment

**Best for**: Managed deployment via Coolify platform.

**Step 1: Deploy NATS Server** (if not already running)
- In Coolify, create a new service from Docker Compose
- Use `deploy/docker-compose.federation.yml`
- Deploy to your server

**Step 2: Deploy the Monitor**
- Create a new service in Coolify
- Connect to this Git repository
- Select `docker-compose.monitor.yml` as the compose file

**Important Coolify Network Notes:**
- Both the Monitor and NATS server must be on the `coolify` network
- The monitor connects to NATS via `ws://nats-seed:9086` (internal Docker network)
- Traefik labels are pre-configured in the compose file

**File**: `docker-compose.monitor.yml`

**Coolify-Specific Settings:**
```yaml
# The monitor expects these networks to exist:
networks:
  coolify:        # Coolify's default network for Traefik routing
    external: true
  truebit-network:  # Shared network for NATS communication
    name: truebit-federation-network
```

---

### Option 4: AWS/Remote Server

**Best for**: Running monitor on a separate server from your TrueBit node.

```bash
# Clone the repository
git clone https://github.com/marcuspuchalla/truebit-node-monitor.git
cd truebit-node-monitor

# Start the monitor
docker compose -f docker-compose.monitor.aws.yml up -d

# Enable federation to connect to the network
curl -X POST http://localhost:8090/api/federation/enable
```

**File**: `docker-compose.monitor.aws.yml`

**Note**: After a fresh deployment, you must enable federation via the API or UI to connect to the network.

---

## Federation Aggregator

> **Important**: The federation aggregator is currently centralized. Only ONE aggregator should run for the entire network. If you run your own aggregator, you will NOT participate in the global network statistics.

The aggregator is currently hosted at `f.tru.watch` and all monitors connect to it by default. This may change in the future to support decentralized aggregation.

### For Reference Only (Do Not Deploy Unless Replacing Central Hub)

```bash
# Only if you are setting up a new federation network
docker compose -f docker-compose.aggregator.yml up -d
```

**File**: `docker-compose.aggregator.yml`

**What the Aggregator Does:**
- Subscribes to: `truebit.tasks.*`, `truebit.invoices.*`, `truebit.heartbeat`
- Publishes: `truebit.stats.aggregated` (every 30 seconds)
- Stores: Aggregated statistics in SQLite database

---

## Environment Variables

### Basic Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `8090` | HTTP server port |
| `CONTAINER_NAME` | `runner-node` | Name of TrueBit node container |
| `DB_PATH` | `/app/data/truebit-monitor.db` | Database file path |
| `LOG_RETENTION_DAYS` | `30` | Days to keep log history |
| `FEDERATION_NATS_URL` | `wss://f.tru.watch:9086` | NATS server URL |
| `ALLOWED_ORIGINS` | `*` | Allowed CORS origins |

### Security Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `API_KEY` | (none) | **IMPORTANT**: Set this to enable API authentication. Without it, anyone with network access can query your backend. |
| `TASK_DATA_PASSWORD` | (none) | Password to protect task input/output data. If set, users must enter this password to view sensitive task data in the web UI. |
| `WS_AUTH_REQUIRED` | `false` | Require WebSocket authentication |
| `WS_AUTH_TOKEN` | (random) | WebSocket authentication token |
| `WS_MAX_CONNECTIONS` | `100` | Maximum total WebSocket connections |
| `WS_MAX_PER_IP` | `5` | Maximum WebSocket connections per IP address |
| `WS_AUTH_TIMEOUT` | `30000` | Milliseconds before unauthenticated connections are closed |

### Security Recommendations

**For production deployments, you should:**

1. **Set `API_KEY`** - This protects your backend API from unauthorized access:
   ```bash
   export API_KEY="your-secure-random-key-here"
   ```
   Then include the key in requests:
   ```bash
   curl -H "Authorization: Bearer your-secure-random-key-here" http://localhost:8090/api/status
   ```

2. **Set `TASK_DATA_PASSWORD`** - This protects your task input/output data from being viewed by others:
   ```bash
   export TASK_DATA_PASSWORD="your-task-data-password"
   ```
   When viewing task details in the web UI, you'll be prompted to enter this password to view input/output data.

3. **Restrict `ALLOWED_ORIGINS`** - Only allow your own domain:
   ```bash
   export ALLOWED_ORIGINS="https://your-domain.com"
   ```

4. **Use HTTPS** - Deploy behind a reverse proxy (Traefik, nginx) with TLS certificates.

---

## Enabling Federation

Federation is **opt-in** and disabled by default. To participate:

### Via UI
1. Navigate to the **Federation** page
2. Click **Enable Federation**
3. View network statistics and connected peers

### Via API
```bash
# Enable federation
curl -X POST http://localhost:8090/api/federation/enable

# Check status
curl http://localhost:8090/api/federation/status

# Disable federation
curl -X POST http://localhost:8090/api/federation/disable
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Your Server                                   │
│  ┌─────────────────┐     ┌─────────────────────────────────┐   │
│  │  TrueBit Node   │     │      TrueBit Monitor            │   │
│  │  (runner-node)  │────>│  ┌─────────┐  ┌─────────────┐   │   │
│  │                 │logs │  │ Backend │  │  Frontend   │   │   │
│  └─────────────────┘     │  │ (Node)  │  │  (Vue.js)   │   │   │
│                          │  └────┬────┘  └─────────────┘   │   │
│                          │       │                          │   │
│                          │  ┌────▼────┐                     │   │
│                          │  │ SQLite  │ (local storage)     │   │
│                          │  └─────────┘                     │   │
│                          └──────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────┘
                                   │ Federation (optional, WSS)
                                   ▼
                    ┌──────────────────────────────┐
                    │   NATS Server (f.tru.watch)  │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │      Aggregator              │
                    │  (Network Statistics)        │
                    └──────────────────────────────┘
```

**Technologies:**
- **Backend**: Node.js + Express + SQLite
- **Frontend**: Vue 3 + Tailwind CSS
- **Federation**: NATS.io over WebSocket (WSS)
- **Monitoring**: Real-time log parsing from TrueBit node

---

## Project Structure

```
truebit-node-monitor/
├── backend/                  # Node.js backend
│   └── src/
│       ├── federation/       # Federation client & anonymizer
│       ├── parsers/          # Log parsers
│       ├── routes/           # API routes
│       ├── db/               # Database layer
│       └── utils/            # Privacy checker & utilities
├── frontend/                 # Vue.js frontend
│   └── src/
│       ├── views/            # Page components
│       ├── components/       # Reusable components
│       ├── stores/           # Pinia stores
│       └── services/         # API services
├── federation-aggregator/    # Statistics aggregator service
│   └── src/
│       ├── database.ts       # Aggregation database
│       ├── nats-client.ts    # NATS WebSocket client
│       └── index.ts          # Main aggregator logic
├── docs/                     # Documentation
│   ├── overview.html         # Overview presentation
│   ├── federation-architecture.html
│   └── FEDERATION.md         # Federation documentation
├── deploy/                   # Federation infrastructure
│   ├── nats-server.conf      # NATS server config
│   └── docker-compose.federation.yml
└── Docker Compose Files:
    ├── docker-compose.standalone.yml   # Direct Docker
    ├── docker-compose.https.yml        # With Traefik/HTTPS
    ├── docker-compose.monitor.yml      # For Coolify
    ├── docker-compose.monitor.aws.yml  # For AWS/remote
    └── docker-compose.aggregator.yml   # Aggregator (central only)
```

---

## Development

### Backend Development
```bash
cd backend
npm install
npm run dev
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Run Type Checks
```bash
cd backend && npm run type-check
cd frontend && npm run type-check
```

---

## Security Considerations

### Docker Socket Access
The monitor requires read-only access to the Docker socket to read container logs. This is mounted as:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

**Risk**: Docker socket access allows reading logs from any container. The monitor only accesses the `runner-node` container.

**Mitigation**: The socket is mounted read-only. Consider running in a restricted Docker environment.

### Data Storage
- All data is stored locally in SQLite (`/app/data/truebit-monitor.db`)
- Wallet addresses are hashed before any external transmission
- Task input/output is never transmitted to federation

### Federation Privacy
See [Privacy Guarantees](#privacy-guarantees) above. Federation is:
- Opt-in only
- All data anonymized before transmission
- IP addresses hidden via NATS protocol
- Metrics bucketed to prevent fingerprinting

---

## Documentation

All documentation is located in the `docs/` folder:

- [Overview Presentation](docs/overview.html) - Interactive HTML5 introduction
- [Federation Architecture Presentation](docs/federation-architecture.html) - Deep dive into federation
- [Federation Documentation](docs/FEDERATION.md) - Complete federation guide

Open the HTML presentations in any web browser. Use arrow keys or click to navigate.

---

## Troubleshooting

### Monitor can't connect to TrueBit node
```bash
# Check if runner-node container exists
docker ps | grep runner-node

# Verify Docker socket is accessible
docker compose -f docker-compose.standalone.yml logs monitor
```

### Federation not connecting
```bash
# Check federation status
curl http://localhost:8090/api/federation/status

# Enable federation manually
curl -X POST http://localhost:8090/api/federation/enable

# Check NATS connectivity
curl http://localhost:8090/api/federation/settings
```

### Coolify deployment issues
1. Ensure both services are on the `coolify` network
2. Check that `truebit-federation-network` exists
3. Verify Traefik labels are correct

---

## License

MIT License

## Contributing

Contributions are welcome! Please submit PRs via GitHub.

## Support

- Issues: [GitHub Issues](https://github.com/marcuspuchalla/truebit-node-monitor/issues)
- Discussions: [GitHub Discussions](https://github.com/marcuspuchalla/truebit-node-monitor/discussions)

---

**Built with privacy, security, and decentralization in mind.**
