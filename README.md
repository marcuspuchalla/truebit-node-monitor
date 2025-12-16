# TrueBit Node Monitor

A community-built monitoring dashboard for TrueBit computation nodes.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-%3E%3D20.10-blue)](https://www.docker.com/)

## What is this?

The TrueBit Node Monitor is a community tool that provides visibility into the TrueBit network. It allows node operators to:

- **Monitor your own node**: Track tasks, invoices, and performance metrics on your local dashboard
- **See network-wide statistics**: View how many nodes are currently online and how many tasks have been processed across the network

**Important**: Network statistics only include nodes that have this monitor installed and have opted into federation. The more node operators who install this tool, the more complete the network picture becomes.

## How it Works

This repository contains everything needed to run the monitoring system:

1. **Node Monitor** (required): A single Docker container that runs alongside your TrueBit node on the same server. It reads logs from your `runner-node` container and provides a local web dashboard.

2. **Federation** (optional): When enabled, your monitor connects to a central aggregation server (`f.tru.watch`) that collects anonymized statistics from all participating nodes. This is how we can display network-wide metrics like total online nodes and completed tasks.

You only need to run one container - the Node Monitor. The federation server is already running and available for all monitors to connect to.

## Important Notices

**USE AT YOUR OWN RISK**: This software is provided "as is" without warranties. The authors are not responsible for any damages or losses.

**NOT AFFILIATED WITH TRUEBIT**: This is an independent, community-developed tool. It is not officially associated with TrueBit Foundation or any TrueBit entities.

## What is TrueBit?

[TrueBit](https://truebit.io/) is a decentralized computation protocol that enables trustless off-chain computation for Ethereum and other blockchains. Node operators run "solver" or "verifier" nodes that:

- **Receive tasks**: Computation requests from smart contracts
- **Execute computations**: Run WebAssembly code off-chain
- **Submit results**: Return computation results on-chain
- **Earn rewards**: Receive payment via invoices for completed work

## Features

- **Real-time Dashboard**: Monitor tasks, invoices, and node status
- **Task History**: View completed tasks with execution metrics
- **Invoice Tracking**: Track earnings and payment history
- **Log Viewer**: Search and filter node logs
- **Federation**: Optional anonymized network statistics sharing
- **Privacy-First**: Strong privacy guarantees for federation data

## Prerequisites

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher
- **TrueBit Node**: Running `runner-node` container
- **Operating System**: Linux, macOS, or Windows with WSL2

## Quick Start

### 1. Create Docker Network (if needed)

The monitor needs to connect to the same network as your TrueBit node:

```bash
# Check if the network exists
docker network ls | grep truebit

# If not, create it (or use your TrueBit node's network name)
docker network create truebit_runner_node_default
```

### 2. Deploy the Monitor

```bash
git clone https://github.com/marcuspuchalla/truebit-node-monitor.git
cd truebit-node-monitor
docker compose -f docker-compose.standalone.yml up -d
```

### 3. Get Your Password

Dashboard access is password-protected. Find the auto-generated password:

```bash
docker logs truebit-node-monitor 2>&1 | grep -A1 "Password"
```

### 4. Access the Dashboard

Open `http://localhost:8090` in your browser.

## Security Warning

**Docker Socket Access**: This application requires access to the Docker socket to read container logs. The socket is mounted read-only (`:ro`), but be aware:

- The container can list and inspect other containers
- The container can read logs from other containers
- This is necessary for monitoring functionality

For maximum security:
- Run in an isolated environment
- Use HTTPS in production
- Set strong passwords via environment variables
- Review the source code before deployment

## Deployment Options

| File | Use Case |
|------|----------|
| `docker-compose.standalone.yml` | Basic deployment (same server as TrueBit node) |
| `docker-compose.https.yml` | Production with HTTPS (Traefik + Let's Encrypt) |
| `docker-compose.monitor.yml` | Coolify deployment |

### Standalone Deployment

```bash
docker compose -f docker-compose.standalone.yml up -d
```

### HTTPS Deployment (Production)

```bash
# Configure environment
cp .env.example .env
nano .env  # Set DOMAIN and ACME_EMAIL

# Deploy
docker compose -f docker-compose.https.yml up -d
```

### Coolify Deployment

1. Create a new service in Coolify
2. Select "Docker Compose" as deployment type
3. Connect your GitHub repository
4. Select `docker-compose.monitor.yml`
5. Add required environment variables in Coolify dashboard
6. Deploy

**Note**: Ensure Docker socket access is enabled in Coolify settings.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTAINER_NAME` | `runner-node` | TrueBit node container name |
| `TASK_DATA_PASSWORD` | (auto-generated) | Dashboard access password |
| `API_KEY` | (none) | API authentication key |
| `FEDERATION_NATS_URL` | `wss://f.tru.watch` | Federation server URL |
| `HTTPS_ENABLED` | `false` | Enable HTTPS security headers |
| `LOG_RETENTION_DAYS` | `30` | Days to keep log entries |

See [.env.example](.env.example) for all options.

### Custom Container Name

If your TrueBit node uses a different container name:

```yaml
environment:
  - CONTAINER_NAME=my-truebit-node
```

### Custom Network

If your TrueBit node uses a different network:

```yaml
networks:
  truebit-network:
    external: true
    name: your-network-name
```

## Federation

Federation allows sharing **anonymized** statistics with other node operators. It's opt-in and disabled by default.

### Enable Federation

**Via UI**: Navigate to the Network page (home) - federation connects automatically.

**Via API**:
```bash
curl -X POST http://localhost:8090/api/federation/enable
```

### Privacy Guarantees

When federation is enabled, your data is anonymized before sharing:

| Never Shared | Shared (Anonymized) |
|--------------|---------------------|
| Wallet addresses | Hashed task IDs (with per-node salt) |
| Private keys | Task type categories |
| Task input/output | Bucketed metrics (ranges, not exact values) |
| Your IP address | Node online status |
| Exact values | Aggregated statistics |

**Technical Details**:
- All identifiers are SHA-256 hashed with a unique per-node salt
- Metrics are bucketed into ranges (e.g., "100-500ms" instead of "342ms")
- Timestamps are rounded to 5-minute intervals
- Messages are validated to ensure no sensitive data leaks

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Server                          │
│  ┌─────────────────┐     ┌─────────────────────────┐   │
│  │  TrueBit Node   │────>│    TrueBit Monitor      │   │
│  │  (runner-node)  │logs │  Backend (Express.js)   │   │
│  └─────────────────┘     │  Frontend (Vue.js)      │   │
│                          │  Database (SQLite)      │   │
│                          └───────────┬─────────────┘   │
└──────────────────────────────────────┼─────────────────┘
                                       │ Federation (opt-in)
                                       ▼
                          ┌────────────────────────┐
                          │   f.tru.watch (NATS)   │
                          │   Federation Server    │
                          └────────────────────────┘
```

## Troubleshooting

### Monitor can't find TrueBit node

```bash
# Check if runner-node is running
docker ps | grep runner-node

# Check network connectivity
docker network inspect truebit_runner_node_default

# Verify container name matches
docker logs truebit-node-monitor 2>&1 | grep "container"
```

### Network doesn't exist

```bash
# Create the network
docker network create truebit_runner_node_default

# Or find your TrueBit node's network
docker inspect runner-node --format='{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'
```

### Permission denied for Docker socket

```bash
# Check socket permissions
ls -la /var/run/docker.sock

# On Linux, add user to docker group
sudo usermod -aG docker $USER
```

### Federation not connecting

```bash
# Check federation status
curl http://localhost:8090/api/federation/status

# Re-enable federation
curl -X POST http://localhost:8090/api/federation/enable
```

### Database Issues

```bash
# Check database location
docker exec truebit-node-monitor ls -la /app/data/

# Backup database
docker cp truebit-node-monitor:/app/data/truebit-monitor.db ./backup.db
```

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
# Clone repository
git clone https://github.com/marcuspuchalla/truebit-node-monitor.git
cd truebit-node-monitor

# Install dependencies
npm install

# Backend development
cd backend && npm run dev

# Frontend development (new terminal)
cd frontend && npm run dev
```

### Running Tests

```bash
cd backend && npm test
```

## Backup & Recovery

### Backup Database

```bash
docker cp truebit-node-monitor:/app/data/truebit-monitor.db ./backup-$(date +%Y%m%d).db
```

### Restore Database

```bash
docker cp ./backup.db truebit-node-monitor:/app/data/truebit-monitor.db
docker restart truebit-node-monitor
```

### Backup Federation Credentials

Federation uses a unique node ID and salt. These are stored in the database. To maintain your node identity across reinstalls, backup your database or note the credentials from:

```bash
curl http://localhost:8090/api/federation/settings
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `cd backend && npm test`
5. Submit a pull request

## Security

To report security vulnerabilities, please email security issues privately rather than opening public issues. See [SECURITY.md](SECURITY.md) for details.

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Links

- [TrueBit Official Website](https://truebit.io/)
- [TrueBit Documentation](https://docs.truebit.io/)
- [Report Issues](https://github.com/marcuspuchalla/truebit-node-monitor/issues)
