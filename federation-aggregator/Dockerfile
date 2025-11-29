# Federation Aggregator Dockerfile
FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source
COPY src/ ./src/

# Create data directory
RUN mkdir -p /data

# Environment defaults
ENV NODE_ENV=production
ENV NATS_URL=wss://f.tru.watch:9086
ENV DB_PATH=/data/aggregator.db
ENV PUBLISH_INTERVAL=30000

# Run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app /data

USER nodejs

CMD ["node", "src/index.js"]
