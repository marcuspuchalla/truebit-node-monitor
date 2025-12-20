# TrueBit Node Monitor

The Node Monitor is a dashboard that runs alongside your TrueBit node to track tasks, invoices, and performance metrics.
It includes a light/dark theme toggle and an optional global presence globe (continent-level only).

## Deployment

### Option 1: Coolify

Use `docker-compose.coolify.yml` for Coolify deployments.

1. Create a new project in Coolify
2. Add a Docker Compose resource
3. Set the repository URL
4. Set **Base Directory**: `monitor`
5. Set **Docker Compose File**: `docker-compose.coolify.yml`
6. Deploy

### Option 2: VPS / AWS / Any Server

Use `docker-compose.yml` for standalone deployments.

```bash
# Create the Docker network (connects to your TrueBit node)
docker network create truebit_runner_node_default

# Start the monitor
docker compose up -d

# Get your login password
docker logs truebit-node-monitor 2>&1 | grep -A1 "Password"
```

Open `http://your-server:8090` in your browser.

## Docker Compose Files

| File | Use Case |
|------|----------|
| `docker-compose.yml` | VPS, AWS, or any standalone server |
| `docker-compose.coolify.yml` | Coolify deployment |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTAINER_NAME` | `runner-node` | TrueBit node container name |
| `TASK_DATA_PASSWORD` | (auto-generated) | Dashboard access password |
| `FEDERATION_NATS_URL` | `wss://f.tru.watch` | Federation server URL |
| `LOG_RETENTION_DAYS` | `30` | Days to keep log entries |
| `NODE_CONTINENT` | (empty) | Optional continent bucket for the global presence globe (AF, AN, AS, EU, NA, OC, SA) |

### Custom Container Name

If your TrueBit node uses a different container name, edit the docker-compose file:

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

Federation allows sharing anonymized statistics with other node operators via [tru.watch](https://tru.watch). Enable it in the Federation page of the dashboard.

**Privacy**: Your data is anonymized - identifiers are hashed, metrics are bucketed, timestamps rounded, and wallet addresses are never shared.

### Location Sharing (Default On)

The globe uses approximate city-level buckets from a simple IP-based lookup. You can opt out in the dashboard or override it by setting a custom latitude/longitude in the Location Sharing settings.

### Global Presence Map (Optional)

To appear on the animated globe, set a coarse location bucket:

```
NODE_CONTINENT=NA
```

Continent-only sharing is still supported, but the default is approximate city-level buckets with opt-out.

## Troubleshooting

### Monitor can't find TrueBit node

```bash
# Check if runner-node is running
docker ps | grep runner-node

# Check network connectivity
docker network inspect truebit_runner_node_default
```

### Container name conflict

```bash
# Remove old container and restart
docker rm -f truebit-node-monitor
docker compose up -d
```

### Permission denied for Docker socket

The entrypoint script handles this automatically. If issues persist, ensure the Docker socket is mounted correctly in the compose file.
