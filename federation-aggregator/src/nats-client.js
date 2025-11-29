/**
 * NATS Client for Federation Aggregator
 * Subscribes to all federation messages and publishes aggregated stats
 */

import { connect, StringCodec } from 'nats';

class AggregatorNatsClient {
  constructor(options = {}) {
    this.servers = options.servers || ['wss://f.tru.watch:9086'];
    this.nc = null;
    this.sc = StringCodec();
    this.subscriptions = [];
    this.handlers = {};
    this.connected = false;
  }

  async connect() {
    try {
      console.log(`Connecting to NATS: ${this.servers.join(', ')}`);

      this.nc = await connect({
        servers: this.servers,
        name: 'federation-aggregator',
        reconnect: true,
        maxReconnectAttempts: -1, // Infinite
        reconnectTimeWait: 2000,
        pingInterval: 30000,
        maxPingOut: 3
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
      console.error('Failed to connect to NATS:', error.message);
      this.connected = false;
      return false;
    }
  }

  async subscribe(subject, handler) {
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
          const data = JSON.parse(this.sc.decode(msg.data));
          handler(data, msg.subject);
        } catch (error) {
          console.error(`Error processing message on ${subject}:`, error.message);
        }
      }
    })();

    return sub;
  }

  async publish(subject, data) {
    if (!this.nc) {
      throw new Error('Not connected to NATS');
    }

    const payload = this.sc.encode(JSON.stringify(data));
    this.nc.publish(subject, payload);
  }

  async disconnect() {
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

  isConnected() {
    return this.connected && this.nc && !this.nc.isClosed();
  }
}

export default AggregatorNatsClient;
