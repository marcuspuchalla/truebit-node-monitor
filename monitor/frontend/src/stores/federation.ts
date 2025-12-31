/**
 * Federation Store (Pinia)
 * Manages federation settings, status, messages, and peers
 */

import { defineStore } from 'pinia';
import {
  federationAPI,
  type FederationSettings,
  type FederationStatus,
  type FederationMessage,
  type FederationPeer,
  type FederationStatsResponse,
  type AggregatedNetworkStats
} from '../services/api';

// Federation API errors are non-critical - suppress console spam
// Errors are still stored in state.error for debugging
const SUPPRESS_FEDERATION_ERRORS = true;

interface FederationState {
  // Settings
  settings: FederationSettings;

  // Status
  status: FederationStatus;

  // Federation messages from other nodes
  messages: FederationMessage[];
  messagesLoading: boolean;

  // Known peers
  peers: FederationPeer[];
  peersLoading: boolean;

  // Network statistics (time series)
  networkStats: FederationStatsResponse;

  // Network-wide aggregated statistics (from aggregator)
  aggregatedNetworkStats: AggregatedNetworkStats;

  // Loading states
  settingsLoading: boolean;
  statusLoading: boolean;
  error: string | null;
}

export const useFederationStore = defineStore('federation', {
  state: (): FederationState => ({
    // Settings
    settings: {
      enabled: false,
      nodeId: null,
      privacyLevel: 'balanced',
      shareTasks: true,
      shareStats: true,
      natsServers: [],
      tlsEnabled: true,
      locationEnabled: true,
      locationLabel: null,
      locationLat: null,
      locationLon: null
    },

    // Status
    status: {
      enabled: false,
      connected: false,
      healthy: false,
      status: 'disconnected',
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

    // Network statistics (time series)
    networkStats: {
      timeSeriesStats: [],
      aggregatedStats: [],
      period: '24 hours'
    },

    // Network-wide aggregated statistics (from aggregator)
    aggregatedNetworkStats: {
      activeNodes: 0,
      totalNodes: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      cachedTasks: 0,
      tasksLast24h: 0,
      totalInvoices: 0,
      invoicesLast24h: 0,
      successRate: 0,
      cacheHitRate: 0,
      executionTimeDistribution: {},
      gasUsageDistribution: {},
      stepsComputedDistribution: {},
      memoryUsedDistribution: {},
      chainDistribution: {},
      taskTypeDistribution: {},
      locationDistribution: {},
      lastUpdated: null,
      status: 'awaiting_data'
    },

    // Loading states
    settingsLoading: false,
    statusLoading: false,
    error: null
  }),

  getters: {
    isEnabled: (state): boolean => state.settings.enabled,
    isConnected: (state): boolean => state.status.connected,
    isHealthy: (state): boolean => state.status.healthy,
    totalMessagesSent: (state): number => state.status.stats.messagesSent,
    totalMessagesReceived: (state): number => state.status.stats.messagesReceived,
    activePeerCount: (state): number => state.peers.filter(p => !p.is_blocked).length,
    recentMessages: (state): FederationMessage[] => state.messages.slice(0, 50)
  },

  actions: {
    // Fetch settings
    async fetchSettings(): Promise<void> {
      this.settingsLoading = true;
      this.error = null;
      try {
        const response = await federationAPI.getSettings();
        this.settings = response;
      } catch (error) {
        if (!SUPPRESS_FEDERATION_ERRORS) {
          this.error = (error as Error).message;
          console.error('Failed to fetch federation settings:', error);
        }
      } finally {
        this.settingsLoading = false;
      }
    },

    // Update settings
    async updateSettings(newSettings: Partial<FederationSettings>): Promise<void> {
      this.settingsLoading = true;
      this.error = null;
      try {
        await federationAPI.updateSettings(newSettings);
        await this.fetchSettings();
        await this.fetchStatus();
      } catch (error) {
        this.error = (error as Error).message;
        console.error('Failed to update federation settings:', error);
        throw error;
      } finally {
        this.settingsLoading = false;
      }
    },

    // Enable federation
    async enableFederation(): Promise<void> {
      try {
        await federationAPI.enable();
        await this.fetchSettings();
        await this.fetchStatus();
      } catch (error) {
        this.error = (error as Error).message;
        console.error('Failed to enable federation:', error);
        throw error;
      }
    },

    // Disable federation
    async disableFederation(): Promise<void> {
      try {
        await federationAPI.disable();
        await this.fetchSettings();
        await this.fetchStatus();
      } catch (error) {
        this.error = (error as Error).message;
        console.error('Failed to disable federation:', error);
        throw error;
      }
    },

    // Fetch status
    async fetchStatus(): Promise<void> {
      this.statusLoading = true;
      try {
        const response = await federationAPI.getStatus();
        this.status = response;
      } catch (error) {
        if (!SUPPRESS_FEDERATION_ERRORS) {
          this.error = (error as Error).message;
          console.error('Failed to fetch federation status:', error);
        }
      } finally {
        this.statusLoading = false;
      }
    },

    // Fetch messages
    async fetchMessages(limit = 100, offset = 0, type: string | null = null): Promise<void> {
      this.messagesLoading = true;
      try {
        const response = await federationAPI.getMessages(limit, offset, type);
        this.messages = response.messages;
      } catch (error) {
        if (!SUPPRESS_FEDERATION_ERRORS) {
          this.error = (error as Error).message;
          console.error('Failed to fetch federation messages:', error);
        }
      } finally {
        this.messagesLoading = false;
      }
    },

    // Fetch peers
    async fetchPeers(): Promise<void> {
      this.peersLoading = true;
      try {
        const response = await federationAPI.getPeers();
        this.peers = response.peers;
      } catch (error) {
        if (!SUPPRESS_FEDERATION_ERRORS) {
          this.error = (error as Error).message;
          console.error('Failed to fetch federation peers:', error);
        }
      } finally {
        this.peersLoading = false;
      }
    },

    // Block a peer
    async blockPeer(nodeId: string): Promise<void> {
      try {
        await federationAPI.blockPeer(nodeId);
        await this.fetchPeers();
      } catch (error) {
        this.error = (error as Error).message;
        console.error('Failed to block peer:', error);
        throw error;
      }
    },

    // Fetch network statistics (time series)
    async fetchNetworkStats(hours = 24): Promise<void> {
      try {
        const response = await federationAPI.getStats(hours);
        this.networkStats = response;
      } catch (error) {
        if (!SUPPRESS_FEDERATION_ERRORS) {
          this.error = (error as Error).message;
          console.error('Failed to fetch network stats:', error);
        }
      }
    },

    // Fetch aggregated network statistics (from aggregator)
    async fetchAggregatedNetworkStats(): Promise<void> {
      try {
        const response = await federationAPI.getNetworkStats();
        this.aggregatedNetworkStats = response;
      } catch (error) {
        if (!SUPPRESS_FEDERATION_ERRORS) {
          this.error = (error as Error).message;
          console.error('Failed to fetch aggregated network stats:', error);
        }
      }
    },

    // Initialize store (fetch all data)
    async initialize(): Promise<void> {
      await Promise.all([
        this.fetchSettings(),
        this.fetchStatus(),
        this.fetchMessages(),
        this.fetchPeers(),
        this.fetchAggregatedNetworkStats()
      ]);
    },

    // Refresh data (called periodically)
    async refresh(): Promise<void> {
      await Promise.all([
        this.fetchStatus(),
        this.fetchMessages(50, 0),
        this.fetchPeers(),
        this.fetchAggregatedNetworkStats()
      ]);
    }
  }
});
