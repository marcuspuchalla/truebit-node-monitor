import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';

// Security limits
const MAX_CONNECTIONS = parseInt(process.env.WS_MAX_CONNECTIONS || '100', 10);
const MAX_CONNECTIONS_PER_IP = parseInt(process.env.WS_MAX_PER_IP || '5', 10);
const AUTH_TIMEOUT_MS = parseInt(process.env.WS_AUTH_TIMEOUT || '30000', 10); // 30s

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

/**
 * SECURITY: Properly validate origin using URL parsing
 * Prevents bypass via subdomain/path manipulation (e.g., example.com.evil.com)
 */
function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  // Check for wildcard first
  if (allowedOrigins.includes('*')) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    for (const allowed of allowedOrigins) {
      // Handle entries that might be missing scheme
      let allowedUrl: URL;
      try {
        allowedUrl = new URL(allowed);
      } catch {
        try {
          allowedUrl = new URL(`https://${allowed}`);
        } catch {
          continue;
        }
      }
      // SECURITY: Exact match on origin (protocol + hostname + port)
      if (originUrl.origin === allowedUrl.origin) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

class TruebitWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientInfo>;
  private connectionsByIp: Map<string, number>;
  private authRequired: boolean;
  private validateSessionToken?: (token: string) => boolean;

  constructor(server: Server, config: { validateSessionToken?: (token: string) => boolean } = {}) {
    this.connectionsByIp = new Map();
    this.validateSessionToken = config.validateSessionToken;
    this.authRequired = !!config.validateSessionToken;

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
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];

        // Allow connections with no origin (direct connection, same-origin)
        if (!origin) {
          return callback(true);
        }

        // If no allowlist configured, allow same-origin only (UI works out of box)
        if (allowedOrigins.length === 0) {
          if (process.env.CORS_ALLOW_ALL === 'true') {
            return callback(true);
          }
          const host = info.req.headers.host;
          const forwardedProto = info.req.headers['x-forwarded-proto'] as string | undefined;
          // Check if socket is TLS (encrypted property exists on TLSSocket)
          const isEncrypted = 'encrypted' in info.req.socket && (info.req.socket as { encrypted?: boolean }).encrypted;
          const protocol = forwardedProto || (isEncrypted ? 'https' : 'http');
          const expectedOrigin = host ? `${protocol}://${host}` : '';
          if (origin === expectedOrigin) {
            return callback(true);
          }
          console.warn(`⚠️ WebSocket connection rejected (no allowlist): ${origin}`);
          return callback(false, 403, 'No origin allowlist configured');
        }

        // SECURITY: Use proper URL-based origin matching
        if (isOriginAllowed(origin, allowedOrigins)) {
          callback(true);
        } else {
          console.warn(`⚠️ WebSocket connection rejected from origin: ${origin}`);
          callback(false, 403, 'Forbidden');
        }
      }
    });

    this.clients = new Map();

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = crypto.randomBytes(8).toString('hex');
      const clientIp = req.socket.remoteAddress || 'unknown';

      // Track connection count by IP
      this.connectionsByIp.set(clientIp, (this.connectionsByIp.get(clientIp) || 0) + 1);

      const clientInfo: ClientInfo = {
        authenticated: !this.authRequired,
        connectedAt: new Date(),
        ip: clientIp
      };

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

          if (data.type === 'auth') {
            const token = data.token;
            if (token && this.validateSessionToken?.(token)) {
              clientInfo.authenticated = true;
              if (clientInfo.authTimeout) {
                clearTimeout(clientInfo.authTimeout);
                clientInfo.authTimeout = undefined;
              }
              ws.send(JSON.stringify({
                type: 'auth_success',
                timestamp: new Date().toISOString()
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'auth_failed',
                message: 'Invalid session token',
                timestamp: new Date().toISOString()
              }));
            }
            return;
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

    console.log('WebSocket server initialized');
  }

  /**
   * SECURITY: Sanitize data before broadcasting to WebSocket clients
   * Removes sensitive fields that must never be transmitted
   * F-003: Strip both executionId and execution_id from all broadcasts
   */
  private sanitizeForBroadcast(type: string, data: Record<string, unknown>): Record<string, unknown> {
    if (type === 'task') {
      // SECURITY: Remove sensitive task data including both variants of execution ID
      const {
        input_data, output_data, error_data,
        execution_id, executionId,  // F-003: Strip both variants
        inputData, outputData, errorData,
        ...safe
      } = data;
      return safe;
    } else if (type === 'log') {
      // Remove any wallet addresses or execution IDs from logs (both variants)
      const {
        nodeAddress, node_address,
        executionId, execution_id,  // F-003: Strip both variants
        ...safe
      } = data;
      return safe;
    } else if (type === 'node_status') {
      // Hash the node address before broadcasting
      const { address, executionId, execution_id, ...safe } = data;
      if (address && typeof address === 'string') {
        (safe as Record<string, unknown>).addressHash = crypto.createHash('sha256').update(address).digest('hex').slice(0, 16);
      }
      return safe;
    }
    // SECURITY: Strip execution IDs from all other message types as well
    const { executionId, execution_id, ...safe } = data;
    return safe;
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
      if (client.readyState !== WebSocket.OPEN) return;
      if (this.authRequired && !clientInfo.authenticated) return;
      client.send(message);
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
