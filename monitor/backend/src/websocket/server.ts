import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

// Generate a secure token for WebSocket authentication
const WS_AUTH_TOKEN = process.env.WS_AUTH_TOKEN || crypto.randomBytes(32).toString('hex');

// Security limits
const MAX_CONNECTIONS = parseInt(process.env.WS_MAX_CONNECTIONS || '100', 10);
const MAX_CONNECTIONS_PER_IP = parseInt(process.env.WS_MAX_PER_IP || '5', 10);
const AUTH_TIMEOUT_MS = parseInt(process.env.WS_AUTH_TIMEOUT || '30000', 10); // 30 seconds to authenticate

interface ClientInfo {
  authenticated: boolean;
  connectedAt: Date;
  ip: string | undefined;
  authTimeout?: ReturnType<typeof setTimeout>;
}

interface WSMessage {
  type: string;
  token?: string;
}

class TruebitWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientInfo>;
  private authRequired: boolean;
  private connectionsByIp: Map<string, number>;

  constructor(server: Server) {
    this.connectionsByIp = new Map();

    this.wss = new WebSocketServer({
      server,
      verifyClient: (info: { origin?: string; req: IncomingMessage }, callback: (result: boolean, code?: number, message?: string) => void) => {
        // Check total connection limit
        if (this.clients && this.clients.size >= MAX_CONNECTIONS) {
          console.warn('⚠️ WebSocket connection rejected: max connections reached');
          return callback(false, 503, 'Server at capacity');
        }

        // Check per-IP connection limit
        const clientIp = info.req.socket.remoteAddress || 'unknown';
        const currentIpConnections = this.connectionsByIp.get(clientIp) || 0;
        if (currentIpConnections >= MAX_CONNECTIONS_PER_IP) {
          console.warn(`⚠️ WebSocket connection rejected: too many connections from ${clientIp}`);
          return callback(false, 429, 'Too many connections');
        }

        // Check origin header for CORS-like protection
        const origin = info.origin || info.req.headers.origin;
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

        // Allow connections from allowed origins or if no origin (direct connection)
        if (!origin || allowedOrigins.includes('*')) {
          return callback(true);
        }

        // Check if origin matches any allowed origin
        if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
          callback(true);
        } else {
          console.warn(`⚠️ WebSocket connection rejected from origin: ${origin}`);
          callback(false, 403, 'Forbidden');
        }
      }
    });

    this.clients = new Map(); // Map of client -> { authenticated: boolean, connectedAt: Date }
    this.authRequired = process.env.WS_AUTH_REQUIRED === 'true';

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = crypto.randomBytes(8).toString('hex');
      const clientIp = req.socket.remoteAddress || 'unknown';

      // Track connection count by IP
      this.connectionsByIp.set(clientIp, (this.connectionsByIp.get(clientIp) || 0) + 1);

      const clientInfo: ClientInfo = {
        authenticated: !this.authRequired, // Auto-authenticated if auth not required
        connectedAt: new Date(),
        ip: clientIp
      };

      // Set auth timeout if authentication is required
      if (this.authRequired) {
        clientInfo.authTimeout = setTimeout(() => {
          if (!clientInfo.authenticated) {
            console.warn(`⚠️ WebSocket client ${clientId.slice(0, 8)}... auth timeout - disconnecting`);
            ws.close(4001, 'Authentication timeout');
          }
        }, AUTH_TIMEOUT_MS);
      }

      console.log(`🔌 WebSocket client connected: ${clientId.slice(0, 8)}...`);
      this.clients.set(ws, clientInfo);

      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString()) as WSMessage;

          // Handle authentication message
          if (data.type === 'auth') {
            if (data.token === WS_AUTH_TOKEN) {
              clientInfo.authenticated = true;
              // Clear auth timeout on successful auth
              if (clientInfo.authTimeout) {
                clearTimeout(clientInfo.authTimeout);
                clientInfo.authTimeout = undefined;
              }
              ws.send(JSON.stringify({
                type: 'auth_success',
                timestamp: new Date().toISOString()
              }));
              console.log(`✅ WebSocket client authenticated: ${clientId.slice(0, 8)}...`);
            } else {
              ws.send(JSON.stringify({
                type: 'auth_failed',
                message: 'Invalid token',
                timestamp: new Date().toISOString()
              }));
              console.warn(`⚠️ WebSocket auth failed: ${clientId.slice(0, 8)}...`);
            }
          }

          // Handle ping/pong for connection health
          if (data.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString()
            }));
          }
        } catch {
          // Ignore parse errors for non-JSON messages
        }
      });

      ws.on('close', () => {
        console.log(`🔌 WebSocket client disconnected: ${clientId.slice(0, 8)}...`);
        // Clear auth timeout if pending
        if (clientInfo.authTimeout) {
          clearTimeout(clientInfo.authTimeout);
        }
        // Decrement IP connection count
        const currentCount = this.connectionsByIp.get(clientIp) || 1;
        if (currentCount <= 1) {
          this.connectionsByIp.delete(clientIp);
        } else {
          this.connectionsByIp.set(clientIp, currentCount - 1);
        }
        this.clients.delete(ws);
      });

      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error.message);
        // Clear auth timeout if pending
        if (clientInfo.authTimeout) {
          clearTimeout(clientInfo.authTimeout);
        }
        // Decrement IP connection count
        const currentCount = this.connectionsByIp.get(clientIp) || 1;
        if (currentCount <= 1) {
          this.connectionsByIp.delete(clientIp);
        } else {
          this.connectionsByIp.set(clientIp, currentCount - 1);
        }
        this.clients.delete(ws);
      });

      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connected',
        authRequired: this.authRequired,
        timestamp: new Date().toISOString()
      }));
    });

    // Log auth token at startup (only in development)
    if (process.env.NODE_ENV !== 'production' && this.authRequired) {
      console.log(`🔑 WebSocket auth token: ${WS_AUTH_TOKEN.slice(0, 8)}...`);
    }

    console.log('WebSocket server initialized');
  }

  /**
   * SECURITY: Sanitize data before broadcasting to WebSocket clients
   * Removes sensitive fields that must never be transmitted
   */
  private sanitizeForBroadcast(type: string, data: Record<string, unknown>): Record<string, unknown> {
    if (type === 'task') {
      // Remove sensitive task data
      const { input_data, output_data, error_data, execution_id, inputData, outputData, errorData, ...safe } = data;
      return safe;
    } else if (type === 'log') {
      // Remove any wallet addresses or execution IDs from logs
      const { nodeAddress, executionId, ...safe } = data;
      return safe;
    } else if (type === 'node_status') {
      // Hash the node address before broadcasting
      const { address, ...safe } = data;
      if (address && typeof address === 'string') {
        (safe as Record<string, unknown>).addressHash = crypto.createHash('sha256').update(address).digest('hex').slice(0, 16);
      }
      return safe;
    }
    // For other types (invoice, semaphore), return as-is
    return data;
  }

  broadcast(type: string, data: Record<string, unknown>): void {
    // SECURITY: Sanitize data before broadcasting
    const sanitized = this.sanitizeForBroadcast(type, data);

    const message = JSON.stringify({
      type,
      data: sanitized,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach((clientInfo, client) => {
      // Only send to authenticated clients
      if (client.readyState === WebSocket.OPEN && clientInfo.authenticated) {
        client.send(message);
      }
    });
  }

  // Send log event
  sendLog(log: Record<string, unknown>): void {
    this.broadcast('log', log);
  }

  // Send task event
  sendTask(task: Record<string, unknown>): void {
    this.broadcast('task', task);
  }

  // Send invoice event
  sendInvoice(invoice: Record<string, unknown>): void {
    this.broadcast('invoice', invoice);
  }

  // Send node status update
  sendNodeStatus(status: Record<string, unknown>): void {
    this.broadcast('node_status', status);
  }

  // Send semaphore update
  sendSemaphore(semaphore: Record<string, unknown>): void {
    this.broadcast('semaphore', semaphore);
  }

  // Get connection statistics
  getStats(): { total: number; authenticated: number } {
    const authenticated = Array.from(this.clients.values()).filter(c => c.authenticated).length;
    return {
      total: this.clients.size,
      authenticated
    };
  }

  close(): void {
    this.wss.close();
  }
}

export default TruebitWebSocketServer;
