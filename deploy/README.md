# TrueBit Federation NATS Server - Coolify Deployment

NATS message broker with WebSocket support for TrueBit Monitor Federation, deployed via Coolify with TLS termination through Traefik.

## Overview

- **NATS Version**: 2.10-alpine
- **External URL**: wss://f.tru.watch (standard HTTPS port 443)
- **Internal Port**: 443 (WebSocket, no TLS - Traefik handles TLS)
- **TCP Port**: 4222 (internal)
- **HTTP Monitoring**: 8222 (internal)
- **JetStream**: Enabled
- **Max Payload**: 1MB

## Coolify Configuration

No Traefik configuration changes required - uses standard HTTPS entrypoint.

### Deploy NATS Service

1. Go to **Projects** → Create new project or select existing
2. Click **+ New** → **Docker Compose**
3. Paste the contents of `docker-compose.federation.yml`
4. **Important**: Update the domain in labels if not using `f.tru.watch`:
   ```yaml
   - traefik.http.routers.truebit-nats.rule=Host(`your-domain.com`)
   ```
5. Deploy the service

## Verification

### Test TLS Certificate

```bash
openssl s_client -connect f.tru.watch:443 -servername f.tru.watch </dev/null 2>&1 | head -20
```

### Test WebSocket Connection

```bash
curl -s --http1.1 -m 5 \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  https://f.tru.watch -i | head -10
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
| WSS (TLS) | `wss://f.tru.watch` | Browser/Frontend |
| NATS TCP | `nats://localhost:4222` | Internal services |

## NATS Configuration

The inline configuration creates:

```
port: 4222           # TCP client port
http_port: 8222      # HTTP monitoring
websocket {
  port: 443          # WebSocket port (internal, Traefik routes 443 -> 443)
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

Check that the domain is correctly configured and DNS points to your server.

## Architecture

```
Browser (wss://f.tru.watch)
         │
         ▼
    ┌─────────┐
    │ Traefik │  Port 443 (TLS termination)
    │  Proxy  │  Let's Encrypt certificate
    └────┬────┘
         │
         ▼ (plain WebSocket)
    ┌─────────┐
    │  NATS   │  Port 443 (no_tls: true)
    │ Server  │  JetStream enabled
    └─────────┘
```
