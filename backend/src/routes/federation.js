/**
 * Federation API Routes
 * Handles federation settings, status, messages, and statistics
 */

import express from 'express';
import { validate, schemas } from '../middleware/validate.js';

const router = express.Router();

export function createFederationRouter(db, federation, recreateClient) {
  // Get federation settings
  router.get('/settings', (req, res) => {
    try {
      const settings = db.getFederationSettings();

      if (!settings) {
        return res.json({
          enabled: false,
          privacyLevel: 'balanced',
          shareTasks: true,
          shareStats: true,
          tlsEnabled: true,
          natsServers: []
        });
      }

      // Parse JSON fields
      const natsServers = settings.nats_servers ? JSON.parse(settings.nats_servers) : [];

      res.json({
        enabled: !!settings.enabled,
        nodeId: settings.node_id,
        privacyLevel: settings.privacy_level,
        shareTasks: !!settings.share_tasks,
        shareStats: !!settings.share_stats,
        natsServers,
        tlsEnabled: !!settings.tls_enabled,
        createdAt: settings.created_at,
        updatedAt: settings.updated_at
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update federation settings
  router.put('/settings',
    validate({ body: schemas.federationSettings }),
    async (req, res) => {
      try {
        const settings = req.body;

        // Check if NATS servers changed
        const oldSettings = db.getFederationSettings();
        const oldServers = oldSettings?.nats_servers ? JSON.parse(oldSettings.nats_servers) : [];
        const newServers = settings.natsServers || [];
        const serversChanged = JSON.stringify(oldServers) !== JSON.stringify(newServers);

        // Update database
        db.updateFederationSettings(settings);

        // If NATS servers changed, recreate the client
        if (serversChanged && newServers.length > 0 && recreateClient) {
          console.log('🔄 NATS servers changed, recreating federation client...');
          if (federation.client && federation.client.connected) {
            await federation.client.disconnect();
          }
          await recreateClient();
        }

        // If federation is being enabled, connect
        if (settings.enabled && federation.client && !federation.client.connected) {
          await federation.client.connect();
        }

        // If federation is being disabled, disconnect
        if (!settings.enabled && federation.client && federation.client.connected) {
          await federation.client.disconnect();
        }

        res.json({ success: true, message: 'Federation settings updated' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

  // Enable federation
  router.post('/enable', async (req, res) => {
    try {
      console.log('📥 Enable federation request received');

      // Update settings - enable with all sharing on
      // Also save the default NATS server URL
      const defaultNatsUrl = process.env.FEDERATION_NATS_URL || 'wss://f.tru.watch:9086';
      db.updateFederationSettings({
        enabled: true,
        shareTasks: true,
        shareStats: true,
        privacyLevel: 'minimal',
        natsServers: [defaultNatsUrl]
      });

      console.log('📝 Settings updated in DB');

      // Recreate client and connect
      if (recreateClient) {
        await recreateClient();
        console.log('🔄 Client recreated');
      }

      if (!federation.client) {
        console.log('❌ Federation client is null after recreate');
        return res.status(500).json({ error: 'Federation client not initialized' });
      }

      // Connect to NATS
      console.log('🔌 Calling connect()...');
      const connected = await federation.client.connect();
      console.log(`🔌 Connect result: ${connected}`);

      if (connected) {
        // Subscribe to federation messages after connecting
        await federation.client.subscribeToFederation({
          taskReceived: (data) => console.log('📨 Federation: Task received from', data.nodeId?.slice(0, 8)),
          taskCompleted: (data) => console.log('✅ Federation: Task completed by', data.nodeId?.slice(0, 8)),
          heartbeat: (data) => console.log('💓 Federation: Heartbeat from', data.nodeId?.slice(0, 8)),
          networkStats: (data) => {
            console.log('📊 Federation: Network stats received');
            try {
              db.updateNetworkStats(data);
            } catch (error) {
              console.error('Failed to update network stats:', error.message);
            }
          }
        });

        const settings = db.getFederationSettings();
        console.log('📤 Sending success response, DB enabled:', settings?.enabled);
        res.json({ success: true, message: 'Federation enabled', connected: true });
      } else {
        db.updateFederationSettings({ enabled: false });
        res.status(500).json({ error: 'Failed to connect to federation network' });
      }
    } catch (error) {
      console.error('Enable federation error:', error);
      db.updateFederationSettings({ enabled: false });
      res.status(500).json({ error: error.message });
    }
  });

  // Disable federation
  router.post('/disable', async (req, res) => {
    try {
      if (!federation.client) {
        return res.status(500).json({ error: 'Federation client not initialized' });
      }

      // Update settings
      db.updateFederationSettings({ enabled: false });

      // Disconnect from NATS
      await federation.client.disconnect();

      res.json({ success: true, message: 'Federation disabled' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get federation status
  router.get('/status', (req, res) => {
    try {
      const settings = db.getFederationSettings();

      if (!federation.client) {
        console.log('📊 Status: client not initialized');
        return res.json({
          enabled: false,
          connected: false,
          status: 'not_initialized'
        });
      }

      const stats = federation.client.getStats();
      const response = {
        enabled: settings ? !!settings.enabled : false,
        connected: federation.client.connected,
        healthy: federation.client.isHealthy(),
        status: federation.client.connected ? 'connected' : 'disconnected',
        stats: {
          messagesSent: stats.messagesSent,
          messagesReceived: stats.messagesReceived,
          errors: stats.errors,
          reconnections: stats.reconnections,
          subscriptions: stats.subscriptions,
          circuitOpen: stats.circuitOpen
        },
        nodeId: stats.nodeId
      };

      console.log(`📊 Status: enabled=${response.enabled}, connected=${response.connected}`);
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get federation messages (received from other nodes)
  router.get('/messages',
    validate({ query: schemas.messagesQuery }),
    (req, res) => {
      try {
        const { limit, offset, type } = req.query;
        const messages = db.getFederationMessages(limit, offset, type || null);

        // Parse JSON data field
        const parsedMessages = messages.map(msg => ({
          ...msg,
          data: msg.data ? JSON.parse(msg.data) : null
        }));

        res.json({
          messages: parsedMessages,
          pagination: {
            limit,
            offset,
            hasMore: messages.length === limit
          }
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

  // Get federation peers (other nodes)
  router.get('/peers', (req, res) => {
    try {
      const peers = db.getFederationPeers();

      res.json({
        peers,
        count: peers.length
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Block a peer
  router.post('/peers/:nodeId/block',
    validate({ params: schemas.nodeIdParam }),
    (req, res) => {
      try {
        const { nodeId } = req.params;
        db.blockPeer(nodeId);

        res.json({ success: true, message: `Peer ${nodeId} blocked` });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

  // Get federation network statistics
  router.get('/stats',
    validate({ query: schemas.statsQuery }),
    (req, res) => {
      try {
        const { type, hours } = req.query;

        const stats = db.getFederationStats(type || null, hours);
        const aggregated = db.getAggregatedFederationStats();

        res.json({
          timeSeriesStats: stats,
          aggregatedStats: aggregated,
          period: `${hours} hours`
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

  // Get network-wide aggregated statistics (from aggregator)
  router.get('/network-stats', (req, res) => {
    try {
      const networkStats = db.getNetworkStats();

      if (!networkStats) {
        // Return placeholder stats if no data yet
        return res.json({
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
          lastUpdated: null,
          status: 'awaiting_data'
        });
      }

      res.json({
        ...networkStats,
        status: 'connected'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get privacy report
  router.get('/privacy', (req, res) => {
    try {
      const settings = db.getFederationSettings();
      const messages = db.getFederationMessages(100, 0);
      const peers = db.getFederationPeers();

      res.json({
        privacyGuarantees: {
          walletPrivacy: 'Never collected - your wallet address is completely private',
          taskDataPrivacy: 'Local only - task input/output never leaves your machine',
          ipPrivacy: 'Hidden from peers - NATS protocol prevents IP exposure',
          nodeFingerprinting: 'Prevented - metrics bucketed into ranges',
          activityCorrelation: 'Prevented - random node ID and message batching'
        },
        privacyLevel: settings ? settings.privacy_level : 'balanced',
        dataSharing: {
          tasks: settings ? !!settings.share_tasks : false,
          stats: settings ? !!settings.share_stats : false
        },
        transparency: {
          messagesSent: federation.client ? federation.client.getStats().messagesSent : 0,
          messagesReceived: messages.length,
          knownPeers: peers.length
        },
        privacyScore: 98, // From privacy guarantees document
        recommendation: 'Your privacy is protected - all guarantees are active'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export default createFederationRouter;
