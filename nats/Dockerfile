# NATS Server with WebSocket support for TrueBit Federation
FROM nats:2.10-alpine

# Copy custom configuration
COPY nats.conf /etc/nats/nats.conf

# Expose ports
# 4222 - Client connections
# 8222 - HTTP monitoring
# 443  - WebSocket (TLS)
EXPOSE 4222 8222 443

# Run NATS with our config
CMD ["nats-server", "-c", "/etc/nats/nats.conf"]
