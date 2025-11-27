class WebSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
    this.isConnecting = false;
  }

  connect(url = null) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    // Use nginx WebSocket proxy path
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = url || `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.emit('connected', { timestamp: new Date() });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emit(message.type, message.data || message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.emit('disconnected', { timestamp: new Date() });
        this.attemptReconnect(wsUrl);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.isConnecting = false;
      this.attemptReconnect(wsUrl);
    }
  }

  attemptReconnect(url) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect(url);
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;

    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    if (!this.listeners.has(event)) return;

    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketClient();
