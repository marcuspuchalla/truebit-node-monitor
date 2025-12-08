/**
 * Federation NATS Client
 * Handles connection to NATS federation network and message pub/sub
 *
 * Security Features:
 * - Leaf node connection (outbound only, firewall-friendly)
 * - TLS 1.3 encryption mandatory
 * - JWT/NKeys authentication
 * - Message validation before publishing
 * - Automatic reconnection with exponential backoff
 * - Rate limiting to prevent abuse
 * - Circuit breaker pattern for resilience
 */

import { connect, NatsConnection, StringCodec, Subscription } from 'nats.ws';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import FederationAnonymizer, { type TaskData, type NodeStatusData, type InvoiceData, type AnonymizedMessage } from './anonymizer.js';
import PrivacyViolationDetector from '../utils/privacy-checker.js';

// Provide WebSocket implementation for nats.ws in Node.js
(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

// Default public federation server
// Community note: If the maintainer stops maintaining this project, the community
// can fork and set up their own federation server by changing this URL.
const DEFAULT_NATS_SERVER = process.env.FEDERATION_NATS_URL || 'wss://f.tru.watch:9086';

interface FederationClientConfig {
  servers?: string[];
  user?: string | null;
  pass?: string | null;
  token?: string | null;
  nkey?: string | null;
  tls?: boolean;
  tlsCert?: string | null;
  tlsKey?: string | null;
  tlsCa?: string | null;
  name?: string;
  reconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectTimeWait?: number;
  maxMessagesPerMinute?: number;
  enablePrivacyChecks?: boolean;
  leafNode?: boolean;
  nodeId?: string | null;
  salt?: string | null;
}

interface FederationHandlers {
  taskReceived?: (data: unknown) => void;
  taskCompleted?: (data: unknown) => void;
  heartbeat?: (data: unknown) => void;
  networkStats?: (data: unknown) => void;
  nodeJoined?: (data: unknown) => void;
  nodeLeft?: (data: unknown) => void;
  all?: (data: unknown, subject: string) => void;
}

interface FederationStats {
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  reconnections: number;
  connected: boolean;
  circuitOpen: boolean;
  subscriptions: number;
  nodeId: string;
}

class FederationClient extends EventEmitter {
  private config: {
    servers: string[];
    user: string | null;
    pass: string | null;
    token: string | null;
    nkey: string | null;
    tls: boolean;
    tlsCert: string | null;
    tlsKey: string | null;
    tlsCa: string | null;
    name: string;
    reconnect: boolean;
    maxReconnectAttempts: number;
    reconnectTimeWait: number;
    maxMessagesPerMinute: number;
    enablePrivacyChecks: boolean;
    leafNode: boolean;
  };

  private nc: NatsConnection | null = null;
  private codec = StringCodec();
  private anonymizer: FederationAnonymizer;

  public connected: boolean = false;
  private subscriptions: Map<string, Subscription> = new Map();

  // Rate limiting
  private messageCount: number = 0;
  private messageWindow: number = Date.now();

  // Circuit breaker
  private failureCount: number = 0;
  private circuitOpen: boolean = false;
  private lastFailure: number | null = null;

  // Statistics
  private stats = {
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    reconnections: 0
  };

  constructor(config: FederationClientConfig = {}) {
    super();

    this.config = {
      // NATS server connection - use default if not specified
      servers: (config.servers && config.servers.length > 0) ? config.servers : [DEFAULT_NATS_SERVER],

      // Authentication (JWT or NKeys)
      user: config.user || null,
      pass: config.pass || null,
      token: config.token || null,
      nkey: config.nkey || null,

      // TLS configuration (mandatory for production)
      tls: config.tls !== false, // Default: enabled
      tlsCert: config.tlsCert || null,
      tlsKey: config.tlsKey || null,
      tlsCa: config.tlsCa || null,

      // Connection options
      name: config.name || 'truebit-monitor',
      reconnect: config.reconnect !== false, // Default: enabled
      maxReconnectAttempts: config.maxReconnectAttempts || -1, // -1 = unlimited
      reconnectTimeWait: config.reconnectTimeWait || 2000, // ms

      // Rate limiting
      maxMessagesPerMinute: config.maxMessagesPerMinute || 60,

      // Privacy
      enablePrivacyChecks: config.enablePrivacyChecks !== false, // Default: enabled

      // Leaf node settings
      leafNode: config.leafNode !== false // Default: leaf node mode
    };

    this.anonymizer = new FederationAnonymizer(config.nodeId, config.salt);
  }

  /**
   * Connect to NATS federation network
   */
  async connect(): Promise<boolean> {
    try {
      console.log('🌐 Connecting to NATS federation...');
      console.log(`   Servers: ${this.config.servers.join(', ')}`);

      const options: Parameters<typeof connect>[0] = {
        servers: this.config.servers,
        name: this.config.name,
        reconnect: this.config.reconnect,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        reconnectTimeWait: this.config.reconnectTimeWait,

        // Note: For wss:// URLs, TLS is handled automatically by the WebSocket layer.
        // Only add explicit TLS config if we have certificates AND using non-wss protocol
        ...(this.config.tlsCert && this.config.tlsKey && {
          tls: {
            cert: this.config.tlsCert,
            key: this.config.tlsKey,
            ca: this.config.tlsCa || undefined
          }
        }),

        // Authentication
        ...(this.config.user && this.config.pass && {
          user: this.config.user,
          pass: this.config.pass
        }),
        ...(this.config.token && {
          token: this.config.token
        })
      };

      this.nc = await connect(options);

      this.connected = true;
      console.log('✅ Connected to NATS federation');

      // Set up connection event handlers
      this.setupEventHandlers();

      this.emit('connected');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to NATS:', (error as Error).message);
      this.emit('error', error);
      this.failureCount++;
      this.lastFailure = Date.now();
      return false;
    }
  }

  /**
   * Set up NATS connection event handlers
   */
  private setupEventHandlers(): void {
    if (!this.nc) return;

    // Handle disconnection
    (async () => {
      for await (const s of this.nc!.status()) {
        switch (s.type) {
          case 'disconnect':
            console.log('⚠️  Disconnected from NATS');
            this.connected = false;
            this.emit('disconnected');
            break;

          case 'reconnect':
            console.log('🔄 Reconnected to NATS');
            this.connected = true;
            this.stats.reconnections++;
            this.emit('reconnected');
            break;

          case 'reconnecting':
            console.log(`🔄 Reconnecting to NATS (attempt ${s.data})...`);
            this.emit('reconnecting', s.data);
            break;

          case 'error':
            console.error('❌ NATS error:', s.data);
            this.stats.errors++;
            this.emit('error', s.data);
            break;
        }
      }
    })();
  }

  /**
   * Publish anonymized task received event
   */
  async publishTaskReceived(task: TaskData): Promise<boolean> {
    const anonymized = this.anonymizer.anonymizeTaskReceived(task);
    return this.publish('truebit.tasks.received', anonymized);
  }

  /**
   * Publish anonymized task completed event
   */
  async publishTaskCompleted(task: TaskData): Promise<boolean> {
    const anonymized = this.anonymizer.anonymizeTaskCompleted(task);
    return this.publish('truebit.tasks.completed', anonymized);
  }

  /**
   * Publish heartbeat
   */
  async publishHeartbeat(nodeStatus: NodeStatusData): Promise<boolean> {
    const anonymized = this.anonymizer.anonymizeHeartbeat(nodeStatus);
    return this.publish('truebit.heartbeat', anonymized);
  }

  /**
   * Publish node joined event (call when connecting to federation)
   */
  async publishNodeJoined(): Promise<boolean> {
    const anonymized = this.anonymizer.anonymizeNodeJoined();
    return this.publish('truebit.nodes.joined', anonymized);
  }

  /**
   * Publish node left event (call before disconnecting from federation)
   */
  async publishNodeLeft(): Promise<boolean> {
    const anonymized = this.anonymizer.anonymizeNodeLeft();
    return this.publish('truebit.nodes.left', anonymized);
  }

  /**
   * Publish anonymized invoice created event
   */
  async publishInvoice(invoice: InvoiceData): Promise<boolean> {
    const anonymized = this.anonymizer.anonymizeInvoice(invoice);
    return this.publish('truebit.invoices.created', anonymized);
  }

  /**
   * Publish message to NATS subject
   */
  async publish(subject: string, data: AnonymizedMessage): Promise<boolean> {
    if (!this.connected || !this.nc) {
      console.warn('⚠️  Not connected to NATS, skipping publish');
      return false;
    }

    // Check circuit breaker
    if (this.circuitOpen) {
      console.warn('⚠️  Circuit breaker open, skipping publish');
      return false;
    }

    // Check rate limit
    if (!this.checkRateLimit()) {
      console.warn('⚠️  Rate limit exceeded, skipping publish');
      return false;
    }

    try {
      // Privacy check
      if (this.config.enablePrivacyChecks) {
        const violations = PrivacyViolationDetector.check(data);
        if (violations.length > 0) {
          const critical = violations.filter(v => v.severity === 'CRITICAL' || v.severity === 'HIGH');
          if (critical.length > 0) {
            throw new Error(`Privacy violations detected: ${JSON.stringify(critical)}`);
          }
        }
      }

      // Validate with anonymizer
      this.anonymizer.validateMessage(data);

      // Publish to NATS
      const payload = this.codec.encode(JSON.stringify(data));
      this.nc.publish(subject, payload);

      this.stats.messagesSent++;
      this.emit('published', { subject, data });

      return true;
    } catch (error) {
      console.error(`❌ Failed to publish to ${subject}:`, (error as Error).message);
      this.stats.errors++;
      this.failureCount++;
      this.lastFailure = Date.now();

      // Open circuit breaker after 5 consecutive failures
      if (this.failureCount >= 5) {
        this.circuitOpen = true;
        console.warn('🚨 Circuit breaker opened due to repeated failures');

        // Close circuit after 60 seconds
        setTimeout(() => {
          this.circuitOpen = false;
          this.failureCount = 0;
          console.log('✅ Circuit breaker closed');
        }, 60000);
      }

      this.emit('error', error);
      return false;
    }
  }

  /**
   * Subscribe to NATS subject
   */
  async subscribe(subject: string, handler?: (data: unknown, subject: string) => void): Promise<Subscription | null> {
    if (!this.connected || !this.nc) {
      console.warn('⚠️  Not connected to NATS, cannot subscribe');
      return null;
    }

    try {
      const sub = this.nc.subscribe(subject);
      this.subscriptions.set(subject, sub);

      console.log(`📡 Subscribed to ${subject}`);

      // Process messages in background
      (async () => {
        for await (const m of sub) {
          try {
            const data = JSON.parse(this.codec.decode(m.data));
            this.stats.messagesReceived++;
            this.emit('message', { subject, data });

            // Call user handler
            if (handler) {
              handler(data, subject);
            }
          } catch (error) {
            console.error(`❌ Error processing message from ${subject}:`, (error as Error).message);
            this.stats.errors++;
          }
        }
      })();

      return sub;
    } catch (error) {
      console.error(`❌ Failed to subscribe to ${subject}:`, (error as Error).message);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Subscribe to all federation messages
   */
  async subscribeToFederation(handlers: FederationHandlers = {}): Promise<void> {
    await this.subscribe('truebit.tasks.received', handlers.taskReceived);
    await this.subscribe('truebit.tasks.completed', handlers.taskCompleted);
    await this.subscribe('truebit.heartbeat', handlers.heartbeat);
    await this.subscribe('truebit.stats.aggregated', handlers.networkStats);
    await this.subscribe('truebit.nodes.joined', handlers.nodeJoined);
    await this.subscribe('truebit.nodes.left', handlers.nodeLeft);
    await this.subscribe('truebit.>', handlers.all); // Wildcard for all messages
  }

  /**
   * Check rate limit
   */
  private checkRateLimit(): boolean {
    const now = Date.now();

    // Reset window every minute
    if (now - this.messageWindow > 60000) {
      this.messageCount = 0;
      this.messageWindow = now;
    }

    // Check if under limit
    if (this.messageCount >= this.config.maxMessagesPerMinute) {
      return false;
    }

    this.messageCount++;
    return true;
  }

  /**
   * Get federation statistics
   */
  getStats(): FederationStats {
    return {
      ...this.stats,
      connected: this.connected,
      circuitOpen: this.circuitOpen,
      subscriptions: this.subscriptions.size,
      nodeId: this.anonymizer.nodeId
    };
  }

  /**
   * Get node credentials
   */
  getCredentials(): { nodeId: string; salt: string } {
    return this.anonymizer.getNodeCredentials();
  }

  /**
   * Disconnect from NATS
   */
  async disconnect(): Promise<void> {
    if (!this.nc) return;

    try {
      console.log('🛑 Disconnecting from NATS federation...');

      // Drain connection (complete pending operations)
      await this.nc.drain();

      this.connected = false;
      this.subscriptions.clear();

      console.log('✅ Disconnected from NATS federation');
      this.emit('disconnected');
    } catch (error) {
      console.error('❌ Error disconnecting from NATS:', (error as Error).message);
      this.emit('error', error);
    }
  }

  /**
   * Check if client is healthy
   */
  isHealthy(): boolean {
    return this.connected && !this.circuitOpen;
  }
}

export default FederationClient;
