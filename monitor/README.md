# TrueBit Node Monitor

The Node Monitor is a dashboard that runs alongside your TrueBit node to track tasks, invoices, and performance metrics.

## Quick Start

### Prerequisites

- Docker 20.10 or higher
- A running TrueBit node (`runner-node` container)
- Same Docker network as your TrueBit node

### 1. Create Docker Network (if needed)

```bash
# Check if the network exists
docker network ls | grep truebit

# If not, create it
docker network create truebit_runner_node_default
```

### 2. Deploy

```bash
cd monitor
docker compose -f docker-compose.standalone.yml up -d
```

### 3. Get Your Password

```bash
docker logs truebit-node-monitor 2>&1 | grep -A1 "Password"
```

### 4. Access Dashboard

Open `http://localhost:8090` in your browser.

## Deployment Options

| File | Use Case |
|------|----------|
| `docker-compose.standalone.yml` | Basic deployment (same server as TrueBit node) |
| `docker-compose.https.yml` | Production with HTTPS (Traefik + Let's Encrypt) |
| `docker-compose.coolify.yml` | Coolify deployment |

For AWS and internal network deployments, see the additional docker-compose files.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTAINER_NAME` | `runner-node` | TrueBit node container name |
| `TASK_DATA_PASSWORD` | (auto-generated) | Dashboard access password |
| `FEDERATION_NATS_URL` | `wss://f.tru.watch` | Federation server URL |
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

Federation allows sharing anonymized statistics with other node operators. When enabled, your monitor connects to the [tru.watch](https://tru.watch) federation server (`f.tru.watch`) to display network-wide statistics like total online nodes and completed tasks.

### Enable Federation

Navigate to the Network page in the UI - federation connects automatically.

### Privacy

When federation is enabled, your data is anonymized:

- All identifiers are SHA-256 hashed with a unique per-node salt
- Metrics are bucketed into ranges
- Timestamps are rounded to 5-minute intervals
- Wallet addresses and IPs are never shared

### Use a Different Aggregator

To connect to a different aggregation server:

```yaml
environment:
  - FEDERATION_NATS_URL=wss://your-aggregator.example.com
```

## Security Warning

**Docker Socket Access**: This application requires access to the Docker socket to read container logs. The socket is mounted read-only (`:ro`), but the container can list and inspect other containers.

For maximum security:
- Run in an isolated environment
- Use HTTPS in production
- Set strong passwords via environment variables

## Development

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Run backend
cd backend && npm run dev

# Run frontend (separate terminal)
cd frontend && npm run dev
```

## Troubleshooting

### Monitor can't find TrueBit node

```bash
# Check if runner-node is running
docker ps | grep runner-node

# Check network connectivity
docker network inspect truebit_runner_node_default
```

### Permission denied for Docker socket

```bash
# On Linux, add user to docker group
sudo usermod -aG docker $USER
```

### Federation not connecting

```bash
# Check federation status
curl http://localhost:8090/api/federation/status
```
