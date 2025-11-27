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

# Stage 2: Setup backend with built frontend
FROM node:18-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
RUN npm install --production

# Copy backend source
COPY backend/src ./src

# Copy built frontend from stage 1
COPY --from=frontend-builder /app/frontend/dist ./public

# Create data directory for SQLite database
RUN mkdir -p /app/data

# Expose port
EXPOSE 8090

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8090
ENV HOST=0.0.0.0

# Start the server
CMD ["node", "src/index.js"]
