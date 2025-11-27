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

- **Wallet Completely Private** - Never accessed, stored, or shared
- **Task Data Local-Only** - Input/output never leaves your machine
- **IP Address Hidden** - Network-level privacy via NATS protocol
- **No Node Fingerprinting** - Metrics bucketed into ranges
- **Complete User Control** - Opt-in federation with granular settings

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Running TrueBit node (runner-node container)

### Installation

```bash
# Clone the repository
git clone https://github.com/marcuspuchalla/truebit-node-monitor.git
cd truebit-node-monitor

# Start the monitor
docker compose -f docker-compose.monitor.yml up -d

# Access the dashboard
open http://localhost:8090
```

### Federation (Optional)

To participate in the global monitoring network:

1. Navigate to **Federation** page in the UI
2. Click **Enable Federation**
3. Configure privacy settings
4. Start sharing anonymized statistics

## Architecture

- **Backend**: Node.js + Express + SQLite
- **Frontend**: Vue 3 + Tailwind CSS
- **Federation**: NATS.io for decentralized messaging
- **Monitoring**: Real-time log parsing from TrueBit node

## Documentation

All documentation is located in the `docs/` folder:

- [Overview Presentation](docs/overview.html) - Interactive HTML5 introduction
- [Federation Architecture Presentation](docs/federation-architecture.html) - Deep dive into federation
- [Federation Documentation](docs/FEDERATION.md) - Complete federation guide

Open the HTML presentations in any web browser. Use arrow keys or click to navigate.

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

### Deploy Federation Seed Server
```bash
cd deploy
docker compose -f docker-compose.federation.yml up -d
```

## Project Structure

```
truebit-node-monitor/
├── backend/              # Node.js backend
│   ├── src/
│   │   ├── federation/   # Federation client & anonymizer
│   │   ├── parsers/      # Log parsers
│   │   ├── routes/       # API routes
│   │   ├── db/           # Database layer
│   │   └── utils/        # Privacy checker & utilities
├── frontend/             # Vue.js frontend
│   ├── src/
│   │   ├── views/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── stores/       # Pinia stores
│   │   └── services/     # API services
├── docs/                 # Documentation & presentations
│   ├── overview.html     # Overview presentation
│   ├── federation-architecture.html
│   └── FEDERATION.md     # Federation documentation
├── deploy/               # Deployment configs
│   ├── nats-server.conf  # NATS server config
│   └── docker-compose.federation.yml
└── docker-compose.monitor.yml  # Main deployment file
```

## License

MIT License

## Contributing

Contributions are welcome! Please submit PRs via GitHub.

## Support

- Issues: GitHub Issues
- Discussions: GitHub Discussions

---

**Built with privacy, security, and decentralization in mind.**
