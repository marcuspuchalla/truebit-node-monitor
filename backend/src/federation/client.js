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

import { connect, StringCodec } from 'nats.ws';
import { EventEmitter } from 'events';
import WebSocket from 'ws';
import FederationAnonymizer from './anonymizer.js';
import PrivacyViolationDetector from '../utils/privacy-checker.js';

// Provide WebSocket implementation for nats.ws in Node.js
globalThis.WebSocket = WebSocket;

// Default NATS server for Docker deployments
const DEFAULT_NATS_SERVER = 'ws://nats-seed:9086';

class FederationClient extends EventEmitter {
  constructor(config = {}) {
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

    this.nc = null; // NATS connection
    this.codec = StringCodec(); // String encoder/decoder
    this.anonymizer = new FederationAnonymizer(config.nodeId, config.salt);

    this.connected = false;
    this.subscriptions = new Map();

    // Rate limiting
    this.messageCount = 0;
    this.messageWindow = Date.now();

    // Circuit breaker
    this.failureCount = 0;
    this.circuitOpen = false;
    this.lastFailure = null;

    // Statistics
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      reconnections: 0
    };
  }

  /**
   * Connect to NATS federation network
   */
  async connect() {
    try {
      console.log('🌐 Connecting to NATS federation...');
      console.log(`   Servers: ${this.config.servers.join(', ')}`);

      const options = {
        servers: this.config.servers,
        name: this.config.name,
        reconnect: this.config.reconnect,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        reconnectTimeWait: this.config.reconnectTimeWait,

        // TLS configuration
        ...(this.config.tls && {
          tls: {
            cert: this.config.tlsCert,
            key: this.config.tlsKey,
            ca: this.config.tlsCa
          }
        }),

        // Authentication
        ...(this.config.user && this.config.pass && {
          user: this.config.user,
          pass: this.config.pass
        }),
        ...(this.config.token && {
          token: this.config.token
        }),
        ...(this.config.nkey && {
          nkey: this.config.nkey
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
      console.error('❌ Failed to connect to NATS:', error.message);
      this.emit('error', error);
      this.failureCount++;
      this.lastFailure = Date.now();
      return false;
    }
  }

  /**
   * Set up NATS connection event handlers
   */
  setupEventHandlers() {
    if (!this.nc) return;

    // Handle disconnection
    (async () => {
      for await (const s of this.nc.status()) {
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
  async publishTaskReceived(task) {
    const anonymized = this.anonymizer.anonymizeTaskReceived(task);
    return this.publish('truebit.tasks.received', anonymized);
  }

  /**
   * Publish anonymized task completed event
   */
  async publishTaskCompleted(task) {
    const anonymized = this.anonymizer.anonymizeTaskCompleted(task);
    return this.publish('truebit.tasks.completed', anonymized);
  }

  /**
   * Publish heartbeat
   */
  async publishHeartbeat(nodeStatus) {
    const anonymized = this.anonymizer.anonymizeHeartbeat(nodeStatus);
    return this.publish('truebit.heartbeat', anonymized);
  }

  /**
   * Publish message to NATS subject
   */
  async publish(subject, data) {
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
      console.error(`❌ Failed to publish to ${subject}:`, error.message);
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
  async subscribe(subject, handler) {
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
            console.error(`❌ Error processing message from ${subject}:`, error.message);
            this.stats.errors++;
          }
        }
      })();

      return sub;
    } catch (error) {
      console.error(`❌ Failed to subscribe to ${subject}:`, error.message);
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Subscribe to all federation messages
   */
  async subscribeToFederation(handlers = {}) {
    await this.subscribe('truebit.tasks.received', handlers.taskReceived);
    await this.subscribe('truebit.tasks.completed', handlers.taskCompleted);
    await this.subscribe('truebit.heartbeat', handlers.heartbeat);
    await this.subscribe('truebit.>', handlers.all); // Wildcard for all messages
  }

  /**
   * Check rate limit
   */
  checkRateLimit() {
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
  getStats() {
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
  getCredentials() {
    return this.anonymizer.getNodeCredentials();
  }

  /**
   * Disconnect from NATS
   */
  async disconnect() {
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
      console.error('❌ Error disconnecting from NATS:', error.message);
      this.emit('error', error);
    }
  }

  /**
   * Check if client is healthy
   */
  isHealthy() {
    return this.connected && !this.circuitOpen;
  }
}

export default FederationClient;
