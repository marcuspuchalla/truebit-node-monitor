/**
 * Standalone Token Analytics Server
 * Runs independently without Docker dependency
 * Serves token data from Blockscout and CoinGecko APIs
 */

import express from 'express';
import cors from 'cors';
import TokenService from './services/tokenService.js';

const app = express();
const PORT = process.env.TOKEN_PORT || 8091;

// CORS for frontend
app.use(cors());
app.use(express.json());

// Initialize token service (no database for standalone mode)
const tokenService = new TokenService();

// Helper to wrap responses in expected format
const wrapResponse = (data: unknown) => ({ success: true, data });

// Token routes
app.get('/api/token/metrics', async (req, res) => {
  try {
    const metrics = await tokenService.getMetrics(req.query.refresh === 'true');
    const allBurns = tokenService.getAllBurns();

    // Calculate additional burn stats
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;

    let last24hBurned = 0;
    let last7dBurned = 0;
    let lastBurnTimestamp = 0;

    for (const burn of allBurns.burns) {
      if (now - burn.timestamp <= day) {
        last24hBurned += burn.amountFormatted;
      }
      if (now - burn.timestamp <= week) {
        last7dBurned += burn.amountFormatted;
      }
      if (burn.timestamp > lastBurnTimestamp) {
        lastBurnTimestamp = burn.timestamp;
      }
    }

    // Add formatted fields for frontend display
    const totalBurned = BigInt(metrics.totalBurned);
    const enhanced = {
      ...metrics,
      totalBurnedFormatted: Number(totalBurned) / 1e18,
      totalSupplyFormatted: parseFloat(metrics.totalSupply),
      circulatingSupplyFormatted: parseFloat(metrics.circulatingSupply),
      last24hBurned,
      last7dBurned,
      lastBurnTimestamp
    };
    res.json(wrapResponse(enhanced));
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
  }
});

app.get('/api/token/burns', (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000);
    const burns = tokenService.getBurns(page, limit);
    // Transform burns to add date field and ensure all fields are included
    const transformedBurns = {
      ...burns,
      burns: burns.burns.map(b => ({
        ...b,
        date: new Date(b.timestamp).toISOString(),
        burnType: b.burnType || (b.to?.toLowerCase() === '0x0000000000000000000000000000000000000000' ? 'null' : 'dead')
      }))
    };
    res.json(wrapResponse(transformedBurns));
  } catch (error) {
    console.error('Error fetching burns:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch burns' });
  }
});

app.get('/api/token/burns/chart', (req, res) => {
  try {
    const chartData = tokenService.getChartData();
    res.json(wrapResponse(chartData));
  } catch (error) {
    console.error('Error fetching chart data:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch chart data' });
  }
});

app.get('/api/token/leaderboard', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const leaderboard = tokenService.getLeaderboard(limit);
    // Transform to add rank and totalBurnedFormatted for frontend
    const transformedLeaderboard = leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      totalBurnedFormatted: Number(BigInt(entry.totalBurned)) / 1e18
    }));
    res.json(wrapResponse(transformedLeaderboard));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

app.get('/api/token/info', (req, res) => {
  res.json(wrapResponse({
    contract: '0xf65b5c5104c4fafd4b709d9d60a185eae063276c',
    name: 'Truebit Protocol',
    symbol: 'TRU',
    decimals: 18,
    network: 'Ethereum Mainnet',
    burnAddresses: [
      '0x0000000000000000000000000000000000000000',
      '0x000000000000000000000000000000000000dEaD'
    ],
    purchaseContract: '0x764c64b2a09b09acb100b80d8c505aa6a0302ef2',
    links: {
      etherscan: 'https://etherscan.io/token/0xf65b5c5104c4fafd4b709d9d60a185eae063276c'
    }
  }));
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'token-analytics' });
});

// Manual sync endpoint
app.post('/api/token/sync', async (req, res) => {
  try {
    console.log('[TokenServer] Manual sync triggered...');
    const result = await tokenService.syncBurns();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error syncing:', error);
    res.status(500).json({ error: 'Failed to sync' });
  }
});

// Initialize and start
async function start() {
  console.log('🔥 Starting Standalone Token Analytics Server...\n');

  // Initial sync of burn data
  console.log('📊 Fetching burn history from Blockscout...');
  try {
    const result = await tokenService.syncBurns();
    console.log(`   ✓ Loaded ${result.totalBurns} burn events\n`);
  } catch (error) {
    console.error('   ✗ Initial sync failed:', error);
  }

  // Start periodic sync (every 5 minutes)
  setInterval(async () => {
    try {
      const result = await tokenService.syncBurns();
      if (result.newBurns > 0) {
        console.log(`[TokenServer] Synced ${result.newBurns} new burns`);
      }
    } catch (error) {
      console.error('[TokenServer] Sync error:', error);
    }
  }, 5 * 60 * 1000);

  app.listen(PORT, () => {
    console.log(`✅ Token Analytics Server running on http://localhost:${PORT}`);
    console.log(`   📡 API: http://localhost:${PORT}/api/token/metrics`);
    console.log(`   🔥 Burns: http://localhost:${PORT}/api/token/burns`);
    console.log(`   📈 Chart: http://localhost:${PORT}/api/token/burns/chart`);
    console.log(`   🏆 Leaderboard: http://localhost:${PORT}/api/token/leaderboard\n`);
  });
}

start();
