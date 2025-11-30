/**
 * Federation API Routes
 * Handles federation settings, status, messages, and statistics
 */

import express, { Router, Request, Response } from 'express';
import { validate, schemas } from '../middleware/validate.js';
import type TruebitDatabase from '../db/database.js';
import type FederationClient from '../federation/client.js';

const router: Router = express.Router();

interface FederationHolder {
  client: FederationClient | null;
  heartbeatInterval?: ReturnType<typeof setInterval>;
}

interface MessageRow {
  id: number;
  message_type: string;
  sender_node_id: string;
  received_at: string;
  data: string;
  created_at: string;
}

export function createFederationRouter(
  db: TruebitDatabase,
  federation: FederationHolder,
  recreateClient: () => Promise<void>
): Router {
  // Get federation settings
  router.get('/settings', (req: Request, res: Response) => {
    try {
      const settings = db.getFederationSettings();

      if (!settings) {
        res.json({
          enabled: false,
          privacyLevel: 'balanced',
          shareTasks: true,
          shareStats: true,
          tlsEnabled: true,
          natsServers: []
        });
        return;
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
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Update federation settings
  router.put('/settings',
    validate({ body: schemas.federationSettings }),
    async (req: Request, res: Response) => {
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
        res.status(500).json({ error: (error as Error).message });
      }
    });

  // Enable federation
  router.post('/enable', async (req: Request, res: Response) => {
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
        res.status(500).json({ error: 'Federation client not initialized' });
        return;
      }

      // Connect to NATS
      console.log('🔌 Calling connect()...');
      const connected = await federation.client.connect();
      console.log(`🔌 Connect result: ${connected}`);

      if (connected) {
        // Subscribe to federation messages after connecting
        await federation.client.subscribeToFederation({
          taskReceived: (data: unknown) => console.log('📨 Federation: Task received from', (data as { nodeId?: string }).nodeId?.slice(0, 8)),
          taskCompleted: (data: unknown) => console.log('✅ Federation: Task completed by', (data as { nodeId?: string }).nodeId?.slice(0, 8)),
          heartbeat: (data: unknown) => console.log('💓 Federation: Heartbeat from', (data as { nodeId?: string }).nodeId?.slice(0, 8)),
          networkStats: (data: unknown) => {
            console.log('📊 Federation: Network stats received');
            try {
              db.updateNetworkStats(data as { data?: Record<string, unknown> } & Record<string, unknown>);
            } catch (error) {
              console.error('Failed to update network stats:', (error as Error).message);
            }
          },
          nodeJoined: (data: unknown) => {
            const nodeId = (data as { nodeId?: string }).nodeId;
            console.log('🟢 Federation: Node joined:', nodeId?.slice(0, 17));
            if (nodeId) {
              db.upsertFederationPeer(nodeId);
            }
          },
          nodeLeft: (data: unknown) => {
            const nodeId = (data as { nodeId?: string }).nodeId;
            console.log('🔴 Federation: Node left:', nodeId?.slice(0, 17));
            if (nodeId) {
              db.removePeer(nodeId);
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
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Disable federation
  router.post('/disable', async (req: Request, res: Response) => {
    try {
      if (!federation.client) {
        res.status(500).json({ error: 'Federation client not initialized' });
        return;
      }

      // Update settings
      db.updateFederationSettings({ enabled: false });

      // Disconnect from NATS
      await federation.client.disconnect();

      res.json({ success: true, message: 'Federation disabled' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get federation status
  router.get('/status', (req: Request, res: Response) => {
    try {
      const settings = db.getFederationSettings();

      if (!federation.client) {
        console.log('📊 Status: client not initialized');
        res.json({
          enabled: false,
          connected: false,
          status: 'not_initialized'
        });
        return;
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
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get federation messages (received from other nodes)
  router.get('/messages',
    validate({ query: schemas.messagesQuery }),
    (req: Request, res: Response) => {
      try {
        const { limit, offset, type } = req.query as { limit?: number; offset?: number; type?: string };
        const messages = db.getFederationMessages(limit, offset, type || null) as MessageRow[];

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
        res.status(500).json({ error: (error as Error).message });
      }
    });

  // Get federation peers (other nodes)
  router.get('/peers', (req: Request, res: Response) => {
    try {
      const peers = db.getFederationPeers();

      res.json({
        peers,
        count: peers.length
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Block a peer
  router.post('/peers/:nodeId/block',
    validate({ params: schemas.nodeIdParam }),
    (req: Request, res: Response) => {
      try {
        const { nodeId } = req.params;
        db.blockPeer(nodeId);

        res.json({ success: true, message: `Peer ${nodeId} blocked` });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

  // Get federation network statistics
  router.get('/stats',
    validate({ query: schemas.statsQuery }),
    (req: Request, res: Response) => {
      try {
        const { type, hours } = req.query as { type?: string; hours?: number };

        const stats = db.getFederationStats(type || null, hours);
        const aggregated = db.getAggregatedFederationStats();

        res.json({
          timeSeriesStats: stats,
          aggregatedStats: aggregated,
          period: `${hours} hours`
        });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

  // Get network-wide aggregated statistics (from aggregator)
  router.get('/network-stats', (req: Request, res: Response) => {
    try {
      const networkStats = db.getNetworkStats();

      if (!networkStats) {
        // Return placeholder stats if no data yet
        res.json({
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
        return;
      }

      res.json({
        ...networkStats,
        status: 'connected'
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Get privacy report
  router.get('/privacy', (req: Request, res: Response) => {
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
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Clear all federation data (for fresh start)
  router.post('/reset', async (req: Request, res: Response) => {
    try {
      console.log('🗑️ Clearing federation data...');
      const result = db.clearFederationData();

      console.log(`   Deleted: ${result.messages} messages, ${result.peers} peers, ${result.stats} stats, ${result.networkCache} network cache entries`);

      res.json({
        success: true,
        message: 'Federation data cleared',
        deleted: result
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}

export default createFederationRouter;
