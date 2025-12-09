# TrueBit Node Monitor

A privacy-first monitoring dashboard for TrueBit computation nodes.

## Disclaimer

**USE AT YOUR OWN RISK**: This software is provided "as is" without warranties. The authors are not responsible for any damages or losses.

**NOT AFFILIATED WITH TRUEBIT**: This is an independent, community-developed tool and is not officially associated with TrueBit Foundation or any official TrueBit entities.

## Features

- **Real-time Monitoring**: Track node activity, tasks, and invoices
- **Privacy-First**: Optional federation with strong privacy guarantees
- **Easy Deployment**: Docker-based with multiple deployment options

## Quick Start

### Prerequisites

- Docker and Docker Compose
- TrueBit node running (`runner-node` container)

### Deploy

```bash
git clone https://github.com/marcuspuchalla/truebit-node-monitor.git
cd truebit-node-monitor
docker compose -f docker-compose.standalone.yml up -d
```

Access the dashboard at `http://localhost:8090`

### Get Your Password

Task data is password-protected. Find the auto-generated password in the logs:

```bash
docker logs truebit-node-monitor | grep "🔑"
```

## Deployment Options

| File | Use Case |
|------|----------|
| `docker-compose.standalone.yml` | Basic deployment on same server as TrueBit node |
| `docker-compose.https.yml` | With automatic HTTPS via Traefik + Let's Encrypt |
| `docker-compose.monitor.yml` | Coolify deployment |

### HTTPS Deployment

```bash
cp .env.example .env
# Edit .env: set DOMAIN and ACME_EMAIL
docker compose -f docker-compose.https.yml up -d
```

### Coolify Deployment

1. Create new service from Docker Compose
2. Connect to this repository
3. Select `docker-compose.monitor.yml`

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTAINER_NAME` | `runner-node` | TrueBit node container name |
| `FEDERATION_NATS_URL` | `wss://f.tru.watch` | Federation server URL |
| `TASK_DATA_PASSWORD` | (auto-generated) | Password for task data access |
| `API_KEY` | (none) | Enable API authentication |

### Security Recommendations

For production:

1. **Set `API_KEY`** to protect the API
2. **Set `TASK_DATA_PASSWORD`** or note the auto-generated one from logs
3. **Use HTTPS** via `docker-compose.https.yml` or a reverse proxy

## Federation

Federation allows sharing anonymized network statistics. It's opt-in and disabled by default.

### Enable via UI

Go to **Federation** page → Click **Enable Federation**

### Enable via API

```bash
curl -X POST http://localhost:8090/api/federation/enable
```

### Privacy Guarantees

When federation is enabled:

| Never Shared | Shared (Anonymized) |
|--------------|---------------------|
| Wallet addresses | Hashed task IDs |
| Private keys | Task type categories |
| Task input/output | Bucketed metrics |
| Your IP address | Node online status |
| Exact values | Aggregated statistics |

All identifiers are SHA256 hashed with a per-node salt. Metrics are bucketed into ranges. Timestamps are rounded to 5-minute intervals.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Server                          │
│  ┌─────────────────┐     ┌─────────────────────────┐   │
│  │  TrueBit Node   │────>│    TrueBit Monitor      │   │
│  │  (runner-node)  │logs │  Backend + Frontend     │   │
│  └─────────────────┘     │  SQLite Database        │   │
│                          └───────────┬─────────────┘   │
└──────────────────────────────────────┼─────────────────┘
                                       │ Federation (opt-in)
                                       ▼
                          ┌────────────────────────┐
                          │   f.tru.watch (NATS)   │
                          │   Federation Server    │
                          └────────────────────────┘
```

## Development

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

## Troubleshooting

### Monitor can't find TrueBit node

```bash
# Verify runner-node is running
docker ps | grep runner-node

# Check monitor logs
docker logs truebit-node-monitor
```

### Federation not connecting

```bash
# Check status
curl http://localhost:8090/api/federation/status

# Re-enable
curl -X POST http://localhost:8090/api/federation/enable
```

## License

MIT License - See [LICENSE](LICENSE) file

## Contributing

Contributions welcome! Please submit issues and pull requests on GitHub.
