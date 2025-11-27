import { WebSocketServer } from 'ws';

class TruebitWebSocketServer {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Set();

    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');
      this.clients.add(ws);

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString()
      }));
    });

    console.log('WebSocket server initialized');
  }

  /**
   * SECURITY: Sanitize data before broadcasting to WebSocket clients
   * Removes sensitive fields that must never be transmitted
   */
  sanitizeForBroadcast(type, data) {
    if (type === 'task') {
      // Remove sensitive task data
      const { input_data, output_data, error_data, execution_id, inputData, outputData, errorData, ...safe } = data;
      return safe;
    } else if (type === 'log') {
      // Remove any wallet addresses or execution IDs from logs
      const { nodeAddress, executionId, ...safe } = data;
      return safe;
    }
    // For other types (invoice, node_status, semaphore), return as-is
    return data;
  }

  broadcast(type, data) {
    // SECURITY: Sanitize data before broadcasting
    const sanitized = this.sanitizeForBroadcast(type, data);

    const message = JSON.stringify({
      type,
      data: sanitized,
      timestamp: new Date().toISOString()
    });

    this.clients.forEach((client) => {
      if (client.readyState === 1) { // OPEN
        client.send(message);
      }
    });
  }

  // Send log event
  sendLog(log) {
    this.broadcast('log', log);
  }

  // Send task event
  sendTask(task) {
    this.broadcast('task', task);
  }

  // Send invoice event
  sendInvoice(invoice) {
    this.broadcast('invoice', invoice);
  }

  // Send node status update
  sendNodeStatus(status) {
    this.broadcast('node_status', status);
  }

  // Send semaphore update
  sendSemaphore(semaphore) {
    this.broadcast('semaphore', semaphore);
  }

  close() {
    this.wss.close();
  }
}

export default TruebitWebSocketServer;
