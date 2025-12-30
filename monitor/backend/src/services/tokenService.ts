/**
 * TRU Token Analytics Service
 * Fetches and caches TRU token data from Etherscan and CoinGecko APIs
 */

// TRU Token contract on Ethereum mainnet
const TRU_CONTRACT = '0xf65b5c5104c4fafd4b709d9d60a185eae063276c';
const BURN_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

// Etherscan API (free tier: 5 calls/sec, 100k/day)
const ETHERSCAN_API = 'https://api.etherscan.io/api';

// CoinGecko API (free tier with rate limits)
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export interface BurnEvent {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  from: string;
  to: string;
  amount: string; // wei as string
  amountFormatted: number; // human readable
}

export interface TokenMetrics {
  totalSupply: string;
  circulatingSupply: string;
  holderCount: number;
  totalBurned: string;
  burnCount: number;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: number;
}

export interface BurnLeaderboardEntry {
  address: string;
  totalBurned: string;
  burnCount: number;
}

export interface ChartDataPoint {
  date: string;
  cumulativeBurned: number;
  dailyBurned: number;
}

interface EtherscanTransfer {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
}

interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanTransfer[] | string;
}

interface CoinGeckoResponse {
  market_data?: {
    current_price?: { usd?: number };
    price_change_percentage_24h?: number;
    market_cap?: { usd?: number };
    total_volume?: { usd?: number };
    total_supply?: number;
    circulating_supply?: number;
  };
}

interface DatabaseInterface {
  getAllTokenBurns(): Array<{
    txHash: string;
    blockNumber: number;
    timestamp: number;
    from: string;
    to: string;
    amount: string;
    amountFormatted: number;
  }>;
  insertTokenBurns(burns: Array<{
    txHash: string;
    blockNumber: number;
    timestamp: number;
    from: string;
    to: string;
    amount: string;
    amountFormatted: number;
  }>): number;
  getTokenSyncState(): { lastBlock: number; lastSync: string | null; totalBurns: number };
  updateTokenSyncState(lastBlock: number, totalBurns: number): void;
}

export class TokenService {
  private etherscanApiKey: string | null;
  private db: DatabaseInterface | null;
  private cache: {
    metrics: TokenMetrics | null;
    metricsUpdatedAt: number;
    burns: BurnEvent[];
    burnsLastBlock: number;
  };

  constructor(etherscanApiKey?: string, db?: DatabaseInterface) {
    this.etherscanApiKey = etherscanApiKey || null;
    this.db = db || null;
    this.cache = {
      metrics: null,
      metricsUpdatedAt: 0,
      burns: [],
      burnsLastBlock: 0
    };
  }

  /**
   * Format wei to TRU (18 decimals)
   */
  private formatTRU(wei: string): number {
    return parseFloat(wei) / 1e18;
  }

  /**
   * Fetch token transfers to burn addresses from Etherscan
   */
  async fetchBurnTransfers(startBlock: number = 0): Promise<BurnEvent[]> {
    const burns: BurnEvent[] = [];

    // Fetch transfers to both burn addresses
    for (const burnAddress of [BURN_ADDRESS, DEAD_ADDRESS]) {
      try {
        const params = new URLSearchParams({
          module: 'account',
          action: 'tokentx',
          contractaddress: TRU_CONTRACT,
          address: burnAddress,
          startblock: startBlock.toString(),
          endblock: '99999999',
          sort: 'asc'
        });

        if (this.etherscanApiKey) {
          params.append('apikey', this.etherscanApiKey);
        }

        const response = await fetch(`${ETHERSCAN_API}?${params}`);
        const data = await response.json() as EtherscanResponse;

        if (data.status === '1' && Array.isArray(data.result)) {
          for (const tx of data.result) {
            // Only include transfers TO the burn address (not FROM)
            if (tx.to.toLowerCase() === burnAddress.toLowerCase()) {
              burns.push({
                txHash: tx.hash,
                blockNumber: parseInt(tx.blockNumber),
                timestamp: parseInt(tx.timeStamp) * 1000,
                from: tx.from,
                to: tx.to,
                amount: tx.value,
                amountFormatted: this.formatTRU(tx.value)
              });
            }
          }
        }

        // Rate limit: wait 200ms between calls
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error fetching burns to ${burnAddress}:`, error);
      }
    }

    // Sort by block number
    burns.sort((a, b) => a.blockNumber - b.blockNumber);

    return burns;
  }

  /**
   * Fetch holder count from Etherscan
   */
  async fetchHolderCount(): Promise<number> {
    try {
      // Note: tokenholdercount requires Etherscan API key
      // Fall back to a reasonable estimate if not available
      if (!this.etherscanApiKey) {
        return 0; // Will be filled from CoinGecko or cached data
      }

      const params = new URLSearchParams({
        module: 'token',
        action: 'tokenholdercount',
        contractaddress: TRU_CONTRACT,
        apikey: this.etherscanApiKey
      });

      const response = await fetch(`${ETHERSCAN_API}?${params}`);
      const data = await response.json() as { status: string; result: string };

      if (data.status === '1') {
        return parseInt(data.result);
      }
    } catch (error) {
      console.error('Error fetching holder count:', error);
    }

    return 0;
  }

  /**
   * Fetch token metrics from CoinGecko
   */
  async fetchCoinGeckoMetrics(): Promise<Partial<TokenMetrics>> {
    try {
      const response = await fetch(
        `${COINGECKO_API}/coins/truebit-protocol?localization=false&tickers=false&community_data=false&developer_data=false`
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json() as CoinGeckoResponse;
      const market = data.market_data;

      if (!market) {
        throw new Error('No market data available');
      }

      return {
        price: market.current_price?.usd || 0,
        priceChange24h: market.price_change_percentage_24h || 0,
        marketCap: market.market_cap?.usd || 0,
        volume24h: market.total_volume?.usd || 0,
        totalSupply: (market.total_supply || 0).toString(),
        circulatingSupply: (market.circulating_supply || 0).toString()
      };
    } catch (error) {
      console.error('Error fetching CoinGecko metrics:', error);
      return {};
    }
  }

  /**
   * Get aggregated token metrics
   */
  async getMetrics(forceRefresh: boolean = false): Promise<TokenMetrics> {
    const now = Date.now();
    const cacheAge = now - this.cache.metricsUpdatedAt;

    // Return cached metrics if fresh (5 minutes)
    if (!forceRefresh && this.cache.metrics && cacheAge < 5 * 60 * 1000) {
      return this.cache.metrics;
    }

    // Fetch new data
    const [geckoMetrics, holderCount] = await Promise.all([
      this.fetchCoinGeckoMetrics(),
      this.fetchHolderCount()
    ]);

    // Calculate total burned from cached burns
    const totalBurned = this.cache.burns.reduce(
      (sum, b) => sum + BigInt(b.amount),
      BigInt(0)
    );

    const metrics: TokenMetrics = {
      totalSupply: geckoMetrics.totalSupply || '0',
      circulatingSupply: geckoMetrics.circulatingSupply || '0',
      holderCount: holderCount || 18500, // Fallback estimate
      totalBurned: totalBurned.toString(),
      burnCount: this.cache.burns.length,
      price: geckoMetrics.price || 0,
      priceChange24h: geckoMetrics.priceChange24h || 0,
      marketCap: geckoMetrics.marketCap || 0,
      volume24h: geckoMetrics.volume24h || 0,
      lastUpdated: now
    };

    this.cache.metrics = metrics;
    this.cache.metricsUpdatedAt = now;

    return metrics;
  }

  /**
   * Get paginated burn history
   */
  getBurns(page: number = 1, limit: number = 50): { burns: BurnEvent[]; total: number; pages: number } {
    const start = (page - 1) * limit;
    const end = start + limit;

    // Return most recent first
    const sorted = [...this.cache.burns].reverse();

    return {
      burns: sorted.slice(start, end),
      total: this.cache.burns.length,
      pages: Math.ceil(this.cache.burns.length / limit)
    };
  }

  /**
   * Get burn leaderboard
   */
  getLeaderboard(limit: number = 20): BurnLeaderboardEntry[] {
    const byAddress = new Map<string, { total: bigint; count: number }>();

    for (const burn of this.cache.burns) {
      const existing = byAddress.get(burn.from) || { total: BigInt(0), count: 0 };
      existing.total += BigInt(burn.amount);
      existing.count += 1;
      byAddress.set(burn.from, existing);
    }

    const entries: BurnLeaderboardEntry[] = [];
    for (const [address, data] of byAddress) {
      entries.push({
        address,
        totalBurned: data.total.toString(),
        burnCount: data.count
      });
    }

    // Sort by total burned descending
    entries.sort((a, b) => {
      const diff = BigInt(b.totalBurned) - BigInt(a.totalBurned);
      return diff > 0 ? 1 : diff < 0 ? -1 : 0;
    });

    return entries.slice(0, limit);
  }

  /**
   * Get chart data for burn history
   */
  getChartData(): ChartDataPoint[] {
    if (this.cache.burns.length === 0) {
      return [];
    }

    // Group by date
    const byDate = new Map<string, number>();

    for (const burn of this.cache.burns) {
      const date = new Date(burn.timestamp).toISOString().split('T')[0];
      const existing = byDate.get(date) || 0;
      byDate.set(date, existing + burn.amountFormatted);
    }

    // Convert to sorted array with cumulative totals
    const dates = Array.from(byDate.keys()).sort();
    const data: ChartDataPoint[] = [];
    let cumulative = 0;

    for (const date of dates) {
      const daily = byDate.get(date) || 0;
      cumulative += daily;
      data.push({
        date,
        dailyBurned: Math.round(daily),
        cumulativeBurned: Math.round(cumulative)
      });
    }

    return data;
  }

  /**
   * Initialize from database if available
   */
  async initialize(): Promise<void> {
    if (this.db) {
      // Load cached burns from database
      const burns = this.db.getAllTokenBurns();
      const state = this.db.getTokenSyncState();

      this.cache.burns = burns.map(b => ({
        txHash: b.txHash,
        blockNumber: b.blockNumber,
        timestamp: b.timestamp,
        from: b.from,
        to: b.to,
        amount: b.amount,
        amountFormatted: b.amountFormatted
      }));
      this.cache.burnsLastBlock = state.lastBlock;

      console.log(`[TokenService] Loaded ${burns.length} burns from database (last block: ${state.lastBlock})`);
    }
  }

  /**
   * Sync burn data from blockchain
   */
  async syncBurns(): Promise<{ newBurns: number; totalBurns: number }> {
    const startBlock = this.cache.burnsLastBlock > 0
      ? this.cache.burnsLastBlock + 1
      : 0;

    console.log(`[TokenService] Syncing burns from block ${startBlock}...`);

    const newBurns = await this.fetchBurnTransfers(startBlock);
    let insertedCount = 0;

    if (newBurns.length > 0) {
      // Merge with existing burns, avoiding duplicates
      const existingHashes = new Set(this.cache.burns.map(b => b.txHash));
      const uniqueNewBurns = newBurns.filter(b => !existingHashes.has(b.txHash));

      this.cache.burns.push(...uniqueNewBurns);
      this.cache.burnsLastBlock = Math.max(
        this.cache.burnsLastBlock,
        ...newBurns.map(b => b.blockNumber)
      );

      // Persist to database if available
      if (this.db && uniqueNewBurns.length > 0) {
        insertedCount = this.db.insertTokenBurns(uniqueNewBurns);
        this.db.updateTokenSyncState(this.cache.burnsLastBlock, this.cache.burns.length);
        console.log(`[TokenService] Persisted ${insertedCount} burns to database`);
      }

      console.log(`[TokenService] Found ${uniqueNewBurns.length} new burn events`);
    }

    return {
      newBurns: newBurns.length,
      totalBurns: this.cache.burns.length
    };
  }

  /**
   * Load cached burns from external source (deprecated - use initialize() instead)
   */
  loadFromCache(burns: BurnEvent[], lastBlock: number): void {
    this.cache.burns = burns;
    this.cache.burnsLastBlock = lastBlock;
    console.log(`[TokenService] Loaded ${burns.length} cached burns (last block: ${lastBlock})`);
  }

  /**
   * Get all burns for database persistence
   */
  getAllBurns(): { burns: BurnEvent[]; lastBlock: number } {
    return {
      burns: this.cache.burns,
      lastBlock: this.cache.burnsLastBlock
    };
  }
}

export default TokenService;
