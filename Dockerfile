# Multi-stage build for TrueBit Monitor
# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
RUN npm install

# Copy frontend source
COPY frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Build backend TypeScript
FROM node:18-alpine AS backend-builder

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
RUN npm install

# Copy backend source and tsconfig
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Stage 3: Production image
FROM node:18-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
RUN npm install --production

# Copy built backend from stage 2
COPY --from=backend-builder /app/dist ./dist

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./public

# Copy startup script
COPY docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 8090

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8090
ENV HOST=0.0.0.0

# Start the server with entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
