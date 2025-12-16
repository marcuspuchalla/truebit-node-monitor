/**
 * NATS Client for Federation Aggregator
 * Subscribes to all federation messages and publishes aggregated stats
 */

import { connect, NatsConnection, StringCodec, Subscription } from 'nats.ws';
import WebSocket from 'ws';

// Provide WebSocket implementation for nats.ws in Node.js
(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket;

type MessageHandler = (data: FederationMessage, subject: string) => void;

interface FederationMessage {
  version?: string;
  type?: string;
  nodeId?: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

interface AggregatorNatsClientOptions {
  servers?: string[];
}

class AggregatorNatsClient {
  private servers: string[];
  private nc: NatsConnection | null = null;
  private sc = StringCodec();
  private subscriptions: Subscription[] = [];
  private handlers: Record<string, MessageHandler> = {};
  public connected = false;

  constructor(options: AggregatorNatsClientOptions = {}) {
    this.servers = options.servers || ['wss://f.tru.watch'];
  }

  async connect(): Promise<boolean> {
    try {
      console.log(`Connecting to NATS: ${this.servers.join(', ')}`);

      this.nc = await connect({
        servers: this.servers,
        name: 'federation-aggregator',
        reconnect: true,
        maxReconnectAttempts: -1, // Infinite
        reconnectTimeWait: 2000,
        pingInterval: 30000,
        maxPingOut: 3,
        timeout: 30000 // 30 second connection timeout
      });

      this.connected = true;
      console.log('Connected to NATS server');

      // Handle connection events
      this.nc.closed().then(() => {
        this.connected = false;
        console.log('NATS connection closed');
      });

      return true;
    } catch (error) {
      console.error('Failed to connect to NATS:', (error as Error).message);
      this.connected = false;
      return false;
    }
  }

  async subscribe(subject: string, handler: MessageHandler): Promise<Subscription | null> {
    if (!this.nc) {
      throw new Error('Not connected to NATS');
    }

    const sub = this.nc.subscribe(subject);
    this.subscriptions.push(sub);
    this.handlers[subject] = handler;

    console.log(`Subscribed to: ${subject}`);

    // Process messages
    (async () => {
      for await (const msg of sub) {
        try {
          const data = JSON.parse(this.sc.decode(msg.data)) as FederationMessage;
          handler(data, msg.subject);
        } catch (error) {
          console.error(`Error processing message on ${subject}:`, (error as Error).message);
        }
      }
    })();

    return sub;
  }

  async publish(subject: string, data: unknown): Promise<void> {
    if (!this.nc) {
      throw new Error('Not connected to NATS');
    }

    const payload = this.sc.encode(JSON.stringify(data));
    this.nc.publish(subject, payload);
  }

  async disconnect(): Promise<void> {
    if (this.nc) {
      // Drain subscriptions
      for (const sub of this.subscriptions) {
        await sub.drain();
      }

      await this.nc.drain();
      this.connected = false;
      console.log('Disconnected from NATS');
    }
  }

  isConnected(): boolean {
    return this.connected && this.nc !== null && !this.nc.isClosed();
  }
}

export default AggregatorNatsClient;
