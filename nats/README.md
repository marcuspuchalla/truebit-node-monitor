# NATS Server for TrueBit Federation

NATS is the messaging backbone for the TrueBit Federation network. It enables real-time communication between Node Monitors and Aggregators.

## When Do You Need This?

**Most users don't need to run a NATS server.** The default federation server at [tru.watch](https://tru.watch) (`f.tru.watch`) already includes NATS.

Run your own NATS server if you:
- Are running your own Aggregator
- Want to create a private federation network
- Need full control over the messaging infrastructure

## Quick Start

```bash
cd nats
docker compose up -d
```

## Ports

| Port | Protocol | Description |
|------|----------|-------------|
| 4222 | TCP | NATS client connections |
| 8222 | HTTP | Monitoring and health checks |
| 443 | WebSocket | Browser connections (TLS required for production) |

## Configuration

Edit `nats.conf` to customize the server:

### Enable TLS (Required for Production)

For browser-based monitors to connect, you need WebSocket with TLS:

```conf
websocket {
    port: 443
    tls {
        cert_file: "/etc/nats/certs/server.crt"
        key_file: "/etc/nats/certs/server.key"
    }
}
```

Mount your certificates in docker-compose.yml:

```yaml
volumes:
  - ./certs:/etc/nats/certs:ro
```

### Connection Limits

```conf
max_connections: 10000
max_payload: 1MB
```

## Health Check

```bash
curl http://localhost:8222/healthz
```

## Monitoring

Access NATS monitoring at `http://localhost:8222`:

- `/varz` - Server statistics
- `/connz` - Connection information
- `/routez` - Route information
- `/subsz` - Subscription information

## Running the Full Stack

For a complete federation setup:

```bash
# 1. Start NATS
cd nats
docker compose up -d

# 2. Start Aggregator
cd ../aggregator
docker compose up -d

# 3. Configure monitors to connect
# Set FEDERATION_NATS_URL=wss://your-domain:443 in monitor config
```

## Development

For local development without TLS:

```conf
websocket {
    port: 8080
    no_tls: true
}
```

Then connect monitors using `ws://localhost:8080` (only works for non-browser clients or local development).
