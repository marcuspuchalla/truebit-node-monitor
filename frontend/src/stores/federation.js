/**
 * Federation Store (Pinia)
 * Manages federation settings, status, messages, and peers
 */

import { defineStore } from 'pinia';
import { federationAPI } from '../services/api';

export const useFederationStore = defineStore('federation', {
  state: () => ({
    // Settings
    settings: {
      enabled: false,
      nodeId: null,
      privacyLevel: 'balanced',
      shareTasks: true,
      shareStats: true,
      natsServers: [],
      tlsEnabled: true
    },

    // Status
    status: {
      connected: false,
      healthy: false,
      stats: {
        messagesSent: 0,
        messagesReceived: 0,
        errors: 0,
        reconnections: 0
      }
    },

    // Federation messages from other nodes
    messages: [],
    messagesLoading: false,

    // Known peers
    peers: [],
    peersLoading: false,

    // Network statistics
    networkStats: {
      timeSeriesStats: [],
      aggregatedStats: []
    },

    // Loading states
    settingsLoading: false,
    statusLoading: false,
    error: null
  }),

  getters: {
    isEnabled: (state) => state.settings.enabled,
    isConnected: (state) => state.status.connected,
    isHealthy: (state) => state.status.healthy,
    totalMessagesSent: (state) => state.status.stats.messagesSent,
    totalMessagesReceived: (state) => state.status.stats.messagesReceived,
    activePeerCount: (state) => state.peers.filter(p => !p.is_blocked).length,
    recentMessages: (state) => state.messages.slice(0, 50)
  },

  actions: {
    // Fetch settings
    async fetchSettings() {
      this.settingsLoading = true;
      this.error = null;
      try {
        const response = await federationAPI.getSettings();
        console.log('Store: fetchSettings response:', response);
        this.settings = response;
      } catch (error) {
        this.error = error.message;
        console.error('Failed to fetch federation settings:', error);
      } finally {
        this.settingsLoading = false;
      }
    },

    // Update settings
    async updateSettings(newSettings) {
      this.settingsLoading = true;
      this.error = null;
      try {
        await federationAPI.updateSettings(newSettings);
        await this.fetchSettings();
        await this.fetchStatus();
      } catch (error) {
        this.error = error.message;
        console.error('Failed to update federation settings:', error);
        throw error;
      } finally {
        this.settingsLoading = false;
      }
    },

    // Enable federation
    async enableFederation() {
      try {
        console.log('Store: calling federationAPI.enable()');
        const result = await federationAPI.enable();
        console.log('Store: enable result:', result);
        console.log('Store: fetching settings...');
        await this.fetchSettings();
        console.log('Store: settings after enable:', this.settings);
        console.log('Store: fetching status...');
        await this.fetchStatus();
        console.log('Store: status after enable:', this.status);
      } catch (error) {
        this.error = error.message;
        console.error('Failed to enable federation:', error);
        throw error;
      }
    },

    // Disable federation
    async disableFederation() {
      try {
        await federationAPI.disable();
        await this.fetchSettings();
        await this.fetchStatus();
      } catch (error) {
        this.error = error.message;
        console.error('Failed to disable federation:', error);
        throw error;
      }
    },

    // Fetch status
    async fetchStatus() {
      this.statusLoading = true;
      try {
        const response = await federationAPI.getStatus();
        console.log('Store: fetchStatus response:', response);
        this.status = response;
      } catch (error) {
        this.error = error.message;
        console.error('Failed to fetch federation status:', error);
      } finally {
        this.statusLoading = false;
      }
    },

    // Fetch messages
    async fetchMessages(limit = 100, offset = 0, type = null) {
      this.messagesLoading = true;
      try {
        const response = await federationAPI.getMessages(limit, offset, type);
        this.messages = response.messages;
      } catch (error) {
        this.error = error.message;
        console.error('Failed to fetch federation messages:', error);
      } finally {
        this.messagesLoading = false;
      }
    },

    // Fetch peers
    async fetchPeers() {
      this.peersLoading = true;
      try {
        const response = await federationAPI.getPeers();
        this.peers = response.peers;
      } catch (error) {
        this.error = error.message;
        console.error('Failed to fetch federation peers:', error);
      } finally {
        this.peersLoading = false;
      }
    },

    // Block a peer
    async blockPeer(nodeId) {
      try {
        await federationAPI.blockPeer(nodeId);
        await this.fetchPeers();
      } catch (error) {
        this.error = error.message;
        console.error('Failed to block peer:', error);
        throw error;
      }
    },

    // Fetch network statistics
    async fetchNetworkStats(hours = 24) {
      try {
        const response = await federationAPI.getStats(hours);
        this.networkStats = response;
      } catch (error) {
        this.error = error.message;
        console.error('Failed to fetch network stats:', error);
      }
    },

    // Initialize store (fetch all data)
    async initialize() {
      await Promise.all([
        this.fetchSettings(),
        this.fetchStatus(),
        this.fetchMessages(),
        this.fetchPeers()
      ]);
    },

    // Refresh data (called periodically)
    async refresh() {
      await Promise.all([
        this.fetchStatus(),
        this.fetchMessages(50, 0),
        this.fetchPeers()
      ]);
    }
  }
});
