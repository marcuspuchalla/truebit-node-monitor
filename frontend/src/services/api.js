import axios from 'axios';

// Use relative URL to leverage nginx proxy
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default {
  // Status
  async getStatus() {
    const { data } = await api.get('/status');
    return data;
  },

  async getStats() {
    const { data } = await api.get('/status/stats');
    return data;
  },

  // Tasks
  async getTasks(params = {}) {
    const { data } = await api.get('/tasks', { params });
    return data;
  },

  async getTask(executionId) {
    const { data } = await api.get(`/tasks/${executionId}`);
    return data;
  },

  async getTaskStats() {
    const { data } = await api.get('/tasks/stats/summary');
    return data;
  },

  // Invoices
  async getInvoices(params = {}) {
    const { data } = await api.get('/invoices', { params });
    return data;
  },

  async getInvoiceCount() {
    const { data } = await api.get('/invoices/count');
    return data;
  },

  // Logs
  async getLogs(params = {}) {
    const { data } = await api.get('/logs', { params });
    return data;
  }
};

// Federation API
export const federationAPI = {
  // Settings
  async getSettings() {
    const { data } = await api.get('/federation/settings');
    return data;
  },

  async updateSettings(settings) {
    const { data } = await api.put('/federation/settings', settings);
    return data;
  },

  async enable() {
    const { data } = await api.post('/federation/enable');
    return data;
  },

  async disable() {
    const { data } = await api.post('/federation/disable');
    return data;
  },

  // Status
  async getStatus() {
    const { data } = await api.get('/federation/status');
    return data;
  },

  // Messages
  async getMessages(limit = 100, offset = 0, type = null) {
    const params = { limit, offset };
    if (type) params.type = type;
    const { data } = await api.get('/federation/messages', { params });
    return data;
  },

  // Peers
  async getPeers() {
    const { data } = await api.get('/federation/peers');
    return data;
  },

  async blockPeer(nodeId) {
    const { data } = await api.post(`/federation/peers/${nodeId}/block`);
    return data;
  },

  // Statistics
  async getStats(hours = 24) {
    const { data } = await api.get('/federation/stats', { params: { hours } });
    return data;
  },

  // Privacy
  async getPrivacyReport() {
    const { data } = await api.get('/federation/privacy');
    return data;
  }
};
