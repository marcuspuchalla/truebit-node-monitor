# TrueBit Node Monitor

A community-built monitoring system for TrueBit computation nodes.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-%3E%3D20.10-blue)](https://www.docker.com/)

## What is this?

The TrueBit Node Monitor is a community tool that provides visibility into the TrueBit network. It allows node operators to:

- **Monitor your own node**: Track tasks, invoices, and performance metrics on your local dashboard
- **See network-wide statistics**: View how many nodes are currently online and how many tasks have been processed

**Important**: Network statistics only include nodes that have this monitor installed and have opted into federation. The more node operators who install this tool, the more complete the network picture becomes.

## Project Structure

This repository contains three components:

| Folder | Description | Who needs it |
|--------|-------------|--------------|
| [`monitor/`](monitor/) | Node Monitor dashboard | **Everyone** - Run this alongside your TrueBit node |
| [`aggregator/`](aggregator/) | Federation aggregator | Only if running your own federation network |
| [`nats/`](nats/) | NATS messaging server | Only if running your own federation network |

**Most users only need the `monitor/` component.** The default federation server at `f.tru.watch` (part of the [tru.watch](https://tru.watch) project) is already running and available for all monitors to connect to.

## Quick Start (Node Monitor)

```bash
# Clone the repository
git clone https://github.com/marcuspuchalla/truebit-node-monitor.git
cd truebit-node-monitor/monitor

# Create network if needed
docker network create truebit_runner_node_default

# Deploy
docker compose -f docker-compose.standalone.yml up -d

# Get your password
docker logs truebit-node-monitor 2>&1 | grep -A1 "Password"
```

Open `http://localhost:8090` in your browser.

See [`monitor/README.md`](monitor/README.md) for detailed instructions.

## How Federation Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Server                              │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │  TrueBit Node   │────>│      Node Monitor           │   │
│  │  (runner-node)  │logs │  (monitor/)                 │   │
│  └─────────────────┘     └───────────┬─────────────────┘   │
└──────────────────────────────────────┼─────────────────────┘
                                       │ Federation (opt-in)
                                       ▼
                    ┌──────────────────────────────────┐
                    │     tru.watch Federation         │
                    │        (f.tru.watch)             │
                    │  ┌──────────┐  ┌─────────────┐   │
                    │  │   NATS   │──│ Aggregator  │   │
                    │  │ (nats/)  │  │(aggregator/)│   │
                    │  └──────────┘  └─────────────┘   │
                    └──────────────────────────────────┘
```

1. **Node Monitor** runs on your server, reads logs from your TrueBit node
2. **Federation** (optional) connects to the aggregation server to share anonymized statistics
3. **Aggregator** collects data from all participating monitors and calculates network-wide metrics

## Running Your Own Federation

If you want to run a private federation network instead of using `f.tru.watch`:

1. Deploy NATS server: [`nats/README.md`](nats/README.md)
2. Deploy Aggregator: [`aggregator/README.md`](aggregator/README.md)
3. Configure monitors to connect to your server

## Important Notices

**USE AT YOUR OWN RISK**: This software is provided "as is" without warranties. The authors are not responsible for any damages or losses.

**NOT AFFILIATED WITH TRUEBIT**: This is an independent, community-developed tool. It is not officially associated with TrueBit Foundation or any TrueBit entities.

## What is TrueBit?

[TrueBit](https://truebit.io/) is a decentralized computation protocol that enables trustless off-chain computation for Ethereum and other blockchains. Node operators run "solver" or "verifier" nodes that receive tasks, execute computations, and earn rewards.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

To report security vulnerabilities, please see [SECURITY.md](SECURITY.md).

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Links

- [TrueBit Official Website](https://truebit.io/)
- [TrueBit Documentation](https://docs.truebit.io/)
- [Report Issues](https://github.com/marcuspuchalla/truebit-node-monitor/issues)
