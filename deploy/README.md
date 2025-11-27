# TrueBit Federation NATS Server - Coolify Deployment

NATS message broker with WebSocket support for TrueBit Monitor Federation, deployed via Coolify with TLS termination through Traefik.

## Overview

- **NATS Version**: 2.10-alpine
- **WebSocket Port**: 9086 (with TLS via Traefik)
- **TCP Port**: 4222 (internal)
- **HTTP Monitoring**: 8222 (internal)
- **JetStream**: Enabled
- **Max Payload**: 1MB

## Coolify Configuration

### 1. Update Traefik Proxy Configuration

Go to **Server → Proxy → Configuration** and add the custom entrypoint to Traefik's command section:

```yaml
command:
  # ... existing commands ...
  - '--entrypoints.truebitnats.address=:9086'
```

### 2. Expose Port 9086 in Traefik

In the same Traefik configuration, add port 9086 to the ports section:

```yaml
ports:
  - '80:80'
  - '443:443'
  - '443:443/udp'
  - '8080:8080'
  - '9086:9086'    # <-- Add this line
```

### 3. Restart Traefik Proxy

After making changes, restart the Traefik proxy:
- Go to **Server → Proxy**
- Click **Restart**

### 4. Deploy NATS Service

1. Go to **Projects** → Create new project or select existing
2. Click **+ New** → **Docker Compose**
3. Paste the contents of `docker-compose.federation.yml`
4. **Important**: Update the domain in labels if not using `federation.tru.watch`:
   ```yaml
   - traefik.http.routers.truebit-nats.rule=Host(`your-domain.com`)
   ```
5. Deploy the service

## Verification

### Test TLS Certificate

```bash
openssl s_client -connect federation.tru.watch:9086 -servername federation.tru.watch </dev/null 2>&1 | head -20
```

### Test WebSocket Connection

```bash
curl -s --http1.1 -m 5 \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  https://federation.tru.watch:9086 -i | head -10
```

Expected response:
```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
```

### Test Health Endpoint (internal only)

```bash
docker exec truebit-federation-nats wget -qO- http://localhost:8222/healthz
```

## Connection URLs

| Protocol | URL | Use Case |
|----------|-----|----------|
| WSS (TLS) | `wss://federation.tru.watch:9086` | Browser/Frontend |
| NATS TCP | `nats://localhost:4222` | Internal services |

## NATS Configuration

The inline configuration creates:

```
port: 4222           # TCP client port
http_port: 8222      # HTTP monitoring
websocket {
  port: 9086         # WebSocket port
  no_tls: true       # TLS handled by Traefik
}
jetstream {
  store_dir: /data   # Persistent storage
}
max_payload: 1048576 # 1MB max message size
```

## Troubleshooting

### 500 Internal Server Error

Container not on coolify network. The docker-compose already includes the coolify network, but verify:
```bash
docker network inspect coolify | grep truebit-federation-nats
```

### 404 Not Found

Traefik entrypoint not configured. Check Traefik has `--entrypoints.truebitnats.address=:9086`.

### Connection Refused on Port 9086

1. Check Traefik ports include 9086
2. Restart Traefik proxy

## Architecture

```
Browser (wss://federation.tru.watch:9086)
         │
         ▼
    ┌─────────┐
    │ Traefik │  Port 9086 (TLS termination)
    │  Proxy  │  Let's Encrypt certificate
    └────┬────┘
         │
         ▼ (plain WebSocket)
    ┌─────────┐
    │  NATS   │  Port 9086 (no_tls: true)
    │ Server  │  JetStream enabled
    └─────────┘
```

## Port Allocation

To avoid conflicts with other NATS instances:

| Service | WebSocket Port |
|---------|----------------|
| Other NATS | 9085 |
| TrueBit Federation | 9086 |
