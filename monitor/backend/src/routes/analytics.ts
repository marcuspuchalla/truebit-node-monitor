/**
 * Analytics API Routes
 * Provides cached on-chain data for staking and node registry
 */

import { Router, Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService.js';

export function createAnalyticsRouter(): Router {
  const router = Router();

  /**
   * GET /api/analytics/staking
   * Returns cached staking data (total staked TRU)
   */
  router.get('/staking', async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const data = await analyticsService.getStakingData(forceRefresh);

      res.json({
        success: true,
        data: {
          totalStaked: data.totalStaked,
          lastUpdated: data.lastUpdated,
          network: 'ethereum',
          contract: '0x94D2e9CC66Ac140bC5C2DE552DdFbd32f80eEe86'
        }
      });
    } catch (error) {
      console.error('Error fetching staking data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch staking data'
      });
    }
  });

  /**
   * GET /api/analytics/nodes
   * Returns cached node registry data
   */
  router.get('/nodes', async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const data = await analyticsService.getNodeRegistryData(forceRefresh);

      res.json({
        success: true,
        data: {
          nodeCount: data.nodeCount,
          nodes: data.nodes.map(n => ({
            address: n.address,
            blockRegistered: n.blockRegistered,
            timestampRegistered: n.timestampRegistered,
            registeredAt: n.timestampRegistered > 0
              ? new Date(n.timestampRegistered * 1000).toISOString()
              : null
          })),
          lastUpdated: data.lastUpdated,
          network: 'avalanche',
          contract: '0x67AF2F01D7cb9A52af289b2702772576bd155310'
        }
      });
    } catch (error) {
      console.error('Error fetching node registry data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch node registry data'
      });
    }
  });

  /**
   * GET /api/analytics/nodes/count
   * Returns just the node count (lighter endpoint)
   */
  router.get('/nodes/count', async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const data = await analyticsService.getNodeRegistryData(forceRefresh);

      res.json({
        success: true,
        data: {
          nodeCount: data.nodeCount,
          lastUpdated: data.lastUpdated
        }
      });
    } catch (error) {
      console.error('Error fetching node count:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch node count'
      });
    }
  });

  /**
   * POST /api/analytics/stakes
   * Returns stake info for multiple addresses
   * Body: { addresses: string[] }
   */
  router.post('/stakes', async (req: Request, res: Response) => {
    try {
      const { addresses } = req.body;

      if (!Array.isArray(addresses) || addresses.length === 0) {
        res.status(400).json({
          success: false,
          error: 'addresses array is required'
        });
        return;
      }

      if (addresses.length > 100) {
        res.status(400).json({
          success: false,
          error: 'Maximum 100 addresses per request'
        });
        return;
      }

      const forceRefresh = req.query.refresh === 'true';
      const stakes = await analyticsService.getStakesForAddresses(addresses, forceRefresh);

      const stakesArray: Array<{
        address: string;
        amount: number;
        unlockTime: number | null;
        isLocked: boolean;
      }> = [];

      stakes.forEach((stake, address) => {
        stakesArray.push({
          address,
          amount: stake.amount,
          unlockTime: stake.unlockTime,
          isLocked: stake.isLocked
        });
      });

      res.json({
        success: true,
        data: {
          stakes: stakesArray,
          count: stakesArray.length
        }
      });
    } catch (error) {
      console.error('Error fetching stakes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch stake data'
      });
    }
  });

  /**
   * GET /api/analytics/summary
   * Returns a summary of all analytics data
   */
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';

      const [stakingData, nodeData] = await Promise.all([
        analyticsService.getStakingData(forceRefresh),
        analyticsService.getNodeRegistryData(forceRefresh)
      ]);

      res.json({
        success: true,
        data: {
          staking: {
            totalStaked: stakingData.totalStaked,
            lastUpdated: stakingData.lastUpdated,
            network: 'ethereum'
          },
          nodes: {
            nodeCount: nodeData.nodeCount,
            lastUpdated: nodeData.lastUpdated,
            network: 'avalanche'
          }
        }
      });
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics summary'
      });
    }
  });

  /**
   * GET /api/analytics/cache-status
   * Returns cache status for debugging
   */
  router.get('/cache-status', (req: Request, res: Response) => {
    const status = analyticsService.getCacheStatus();
    res.json({
      success: true,
      data: status
    });
  });

  return router;
}

export default createAnalyticsRouter;
