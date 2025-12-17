# TrueBit Node Monitor

A community-built monitoring dashboard for TrueBit computation nodes.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## What is this?

The TrueBit Node Monitor gives you visibility into your TrueBit node and the network:

- **Monitor your node**: Track tasks, invoices, and performance metrics
- **See network statistics**: View how many nodes are online and tasks processed across the network

**Note**: Network stats only show nodes with this monitor installed. The more operators who install it, the more complete the picture.

## Installation

### Option 1: Coolify (Recommended)

If you use [Coolify](https://coolify.io/) for deployment:

1. Create a new project in Coolify
2. Add a Docker Compose resource
3. Set the repository: `https://github.com/marcuspuchalla/truebit-node-monitor`
4. Set **Base Directory**: `monitor`
5. Set **Docker Compose File**: `docker-compose.coolify.yml`
6. Deploy

### Option 2: VPS / AWS / Any Server

```bash
# Clone the repository
git clone https://github.com/marcuspuchalla/truebit-node-monitor.git
cd truebit-node-monitor/monitor

# Create the Docker network (connects to your TrueBit node)
docker network create truebit_runner_node_default

# Start the monitor
docker compose up -d

# Get your login password
docker logs truebit-node-monitor 2>&1 | grep -A1 "Password"
```

Open `http://your-server:8090` in your browser.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `CONTAINER_NAME` | `runner-node` | Name of your TrueBit node container |
| `TASK_DATA_PASSWORD` | (auto-generated) | Password for the dashboard |
| `FEDERATION_NATS_URL` | `wss://f.tru.watch` | Federation server URL |
| `LOG_RETENTION_DAYS` | `30` | Days to keep log history |

## Federation

Your monitor can optionally share anonymized statistics with the [tru.watch](https://tru.watch) network. This is **opt-in** - enable it in the Federation page of the dashboard after deployment.

---

## For Federation Operators

Most users only need the monitor above. If you're running your own federation network:

| Component | Description | Documentation |
|-----------|-------------|---------------|
| Aggregator | Collects data from monitors | [`aggregator/README.md`](aggregator/README.md) |
| NATS | Messaging server | [`nats/README.md`](nats/README.md) |

---

## Important Notices

**USE AT YOUR OWN RISK**: This software is provided "as is" without warranties.

**NOT AFFILIATED WITH TRUEBIT**: This is an independent, community-developed tool.

## Links

- [TrueBit Official](https://truebit.io/) | [TrueBit Docs](https://docs.truebit.io/)
- [Report Issues](https://github.com/marcuspuchalla/truebit-node-monitor/issues) | [Contributing](CONTRIBUTING.md) | [Security](SECURITY.md)

## License

[GNU General Public License v3.0](LICENSE)
