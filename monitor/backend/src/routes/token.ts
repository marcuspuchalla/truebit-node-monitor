/**
 * Token Analytics API Routes
 * Provides TRU token metrics, burn history, and analytics
 */

import { Router, Request, Response } from 'express';
import type { TokenService } from '../services/tokenService.js';

interface TokenRouterOptions {
  tokenService: TokenService;
}

export function createTokenRouter(options: TokenRouterOptions): Router {
  const router = Router();
  const { tokenService } = options;

  /**
   * GET /api/token/metrics
   * Returns current token metrics (supply, holders, price, burns)
   */
  router.get('/metrics', async (req: Request, res: Response) => {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const metrics = await tokenService.getMetrics(forceRefresh);

      res.json({
        success: true,
        data: {
          ...metrics,
          totalBurnedFormatted: parseFloat(metrics.totalBurned) / 1e18,
          totalSupplyFormatted: parseFloat(metrics.totalSupply),
          circulatingSupplyFormatted: parseFloat(metrics.circulatingSupply)
        }
      });
    } catch (error) {
      console.error('Error fetching token metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch token metrics'
      });
    }
  });

  /**
   * GET /api/token/burns
   * Returns paginated burn history
   */
  router.get('/burns', (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));

      const result = tokenService.getBurns(page, limit);

      res.json({
        success: true,
        data: {
          burns: result.burns.map(b => ({
            ...b,
            amountFormatted: b.amountFormatted,
            date: new Date(b.timestamp).toISOString()
          })),
          pagination: {
            page,
            limit,
            total: result.total,
            pages: result.pages
          }
        }
      });
    } catch (error) {
      console.error('Error fetching burns:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch burn history'
      });
    }
  });

  /**
   * GET /api/token/burns/chart
   * Returns aggregated burn data for charting
   */
  router.get('/burns/chart', (req: Request, res: Response) => {
    try {
      const chartData = tokenService.getChartData();

      res.json({
        success: true,
        data: chartData
      });
    } catch (error) {
      console.error('Error fetching chart data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch chart data'
      });
    }
  });

  /**
   * GET /api/token/leaderboard
   * Returns top burners leaderboard
   */
  router.get('/leaderboard', (req: Request, res: Response) => {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const leaderboard = tokenService.getLeaderboard(limit);

      res.json({
        success: true,
        data: leaderboard.map((entry, index) => ({
          rank: index + 1,
          address: entry.address,
          totalBurned: entry.totalBurned,
          totalBurnedFormatted: parseFloat(entry.totalBurned) / 1e18,
          burnCount: entry.burnCount
        }))
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch leaderboard'
      });
    }
  });

  /**
   * POST /api/token/sync
   * Triggers a sync of burn data from blockchain
   * (Rate limited, requires authentication in production)
   */
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      const result = await tokenService.syncBurns();

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error syncing burns:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync burn data'
      });
    }
  });

  /**
   * GET /api/token/info
   * Returns static token information
   */
  router.get('/info', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        name: 'Truebit',
        symbol: 'TRU',
        decimals: 18,
        contract: '0xf65b5c5104c4fafd4b709d9d60a185eae063276c',
        network: 'ethereum',
        chainId: 1,
        burnAddresses: [
          '0x0000000000000000000000000000000000000000',
          '0x000000000000000000000000000000000000dEaD'
        ],
        links: {
          etherscan: 'https://etherscan.io/token/0xf65b5c5104c4fafd4b709d9d60a185eae063276c',
          coingecko: 'https://www.coingecko.com/en/coins/truebit-protocol',
          website: 'https://truebit.io'
        }
      }
    });
  });

  return router;
}

export default createTokenRouter;
