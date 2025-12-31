/**
 * Analytics Service with caching
 * Caches on-chain data from Ethereum (staking) and Avalanche (node registry)
 * Cache TTL: 5 minutes
 * Auto-refresh: 3 minutes (if no client requests)
 */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const AUTO_REFRESH_INTERVAL = 3 * 60 * 1000; // 3 minutes

// Ethereum (Staking)
const ETHEREUM_RPC = 'https://eth.llamarpc.com';
const STAKING_ADDRESS = '0x94D2e9CC66Ac140bC5C2DE552DdFbd32f80eEe86';

// Avalanche (Node Registry)
const AVALANCHE_RPC = 'https://api.avax.network/ext/bc/C/rpc';
const NODE_REGISTRY_ADDRESS = '0x67AF2F01D7cb9A52af289b2702772576bd155310';

export interface StakingData {
  totalStaked: number;
  lastUpdated: number;
}

export interface NodeInfo {
  address: string;
  blockRegistered: number;
  timestampRegistered: number;
}

export interface NodeRegistryData {
  nodeCount: number;
  nodes: NodeInfo[];
  lastUpdated: number;
}

export interface StakeInfo {
  address: string;
  amount: number;
  unlockTime: number | null;
  isLocked: boolean;
}

interface EthCallResult {
  result?: string;
  error?: { message: string };
}

class AnalyticsService {
  private stakingCache: StakingData | null = null;
  private nodeRegistryCache: NodeRegistryData | null = null;
  private stakesCache: Map<string, StakeInfo> = new Map();
  private stakesLastUpdated: number = 0;
  private autoRefreshTimer: NodeJS.Timeout | null = null;
  private initialized: boolean = false;

  /**
   * Make an eth_call to a contract
   */
  private async ethCall(rpc: string, to: string, data: string): Promise<string> {
    const response = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data }, 'latest']
      })
    });
    const result = await response.json() as EthCallResult;
    if (result.error) {
      throw new Error(result.error.message);
    }
    return result.result || '0x';
  }

  /**
   * Decode uint256 from hex
   */
  private decodeUint256(hex: string): bigint {
    if (!hex || hex === '0x') return BigInt(0);
    return BigInt(hex);
  }

  /**
   * Decode address from hex (last 20 bytes of 32-byte word)
   */
  private decodeAddress(hex: string): string {
    if (!hex || hex.length < 66) return '0x0000000000000000000000000000000000000000';
    return '0x' + hex.slice(-40);
  }

  /**
   * Get staking data with caching
   */
  async getStakingData(forceRefresh = false): Promise<StakingData> {
    const now = Date.now();

    if (!forceRefresh && this.stakingCache && (now - this.stakingCache.lastUpdated) < CACHE_TTL) {
      return this.stakingCache;
    }

    try {
      // totalStaked() selector: 0x817b1cd2
      const result = await this.ethCall(ETHEREUM_RPC, STAKING_ADDRESS, '0x817b1cd2');
      const totalStakedWei = this.decodeUint256(result);
      const totalStaked = Number(totalStakedWei) / 1e18;

      this.stakingCache = {
        totalStaked,
        lastUpdated: now
      };

      console.log(`[AnalyticsService] Staking cache updated: ${totalStaked.toFixed(2)} TRU`);
      return this.stakingCache;
    } catch (error) {
      console.error('[AnalyticsService] Error fetching staking data:', error);
      // Return stale cache if available
      if (this.stakingCache) {
        return this.stakingCache;
      }
      return { totalStaked: 0, lastUpdated: now };
    }
  }

  /**
   * Get node registry data with caching
   */
  async getNodeRegistryData(forceRefresh = false): Promise<NodeRegistryData> {
    const now = Date.now();

    if (!forceRefresh && this.nodeRegistryCache && (now - this.nodeRegistryCache.lastUpdated) < CACHE_TTL) {
      return this.nodeRegistryCache;
    }

    try {
      // getNodeCount() selector: 0x39bf397e
      const countResult = await this.ethCall(AVALANCHE_RPC, NODE_REGISTRY_ADDRESS, '0x39bf397e');
      const nodeCount = Number(this.decodeUint256(countResult));

      const nodes: NodeInfo[] = [];

      // Fetch all nodes
      for (let i = 0; i < nodeCount; i++) {
        try {
          // getNodeAtIndex(uint256) selector: 0x3c59f126
          const indexHex = i.toString(16).padStart(64, '0');
          const nodeResult = await this.ethCall(
            AVALANCHE_RPC,
            NODE_REGISTRY_ADDRESS,
            '0x3c59f126' + indexHex
          );

          // Result is a tuple: (address nodeAddress, uint256 blockRegistered, uint256 timestampRegistered)
          // Each field is 32 bytes (64 hex chars)
          if (nodeResult.length >= 194) { // 0x + 64*3
            const address = this.decodeAddress(nodeResult.slice(2, 66));
            const blockRegistered = Number(this.decodeUint256('0x' + nodeResult.slice(66, 130)));
            const timestampRegistered = Number(this.decodeUint256('0x' + nodeResult.slice(130, 194)));

            nodes.push({
              address,
              blockRegistered,
              timestampRegistered
            });
          }
        } catch (e) {
          console.error(`[AnalyticsService] Error fetching node at index ${i}:`, e);
        }
      }

      this.nodeRegistryCache = {
        nodeCount,
        nodes,
        lastUpdated: now
      };

      console.log(`[AnalyticsService] Node registry cache updated: ${nodeCount} nodes`);
      return this.nodeRegistryCache;
    } catch (error) {
      console.error('[AnalyticsService] Error fetching node registry data:', error);
      // Return stale cache if available
      if (this.nodeRegistryCache) {
        return this.nodeRegistryCache;
      }
      return { nodeCount: 0, nodes: [], lastUpdated: now };
    }
  }

  /**
   * Get stake info for multiple addresses with caching
   */
  async getStakesForAddresses(addresses: string[], forceRefresh = false): Promise<Map<string, StakeInfo>> {
    const now = Date.now();
    const results = new Map<string, StakeInfo>();

    // Check if we need to refresh
    const needsRefresh = forceRefresh || (now - this.stakesLastUpdated) >= CACHE_TTL;

    for (const address of addresses) {
      const lowerAddr = address.toLowerCase();

      // Use cache if fresh
      if (!needsRefresh && this.stakesCache.has(lowerAddr)) {
        const cached = this.stakesCache.get(lowerAddr)!;
        results.set(address, cached);
        continue;
      }

      try {
        // getStake(address) selector: 0x7a766460
        // Encode address as 32-byte padded value
        const addrPadded = address.toLowerCase().replace('0x', '').padStart(64, '0');
        const stakeResult = await this.ethCall(
          ETHEREUM_RPC,
          STAKING_ADDRESS,
          '0x7a766460' + addrPadded
        );

        // Result is tuple: (uint256 amount, uint256 unlockTime)
        if (stakeResult.length >= 130) { // 0x + 64*2
          const amountWei = this.decodeUint256('0x' + stakeResult.slice(2, 66));
          const unlockTimestamp = Number(this.decodeUint256('0x' + stakeResult.slice(66, 130)));
          const amount = Number(amountWei) / 1e18;

          if (amount > 0) {
            const unlockTime = unlockTimestamp > 0 ? unlockTimestamp * 1000 : null;
            const isLocked = unlockTime ? unlockTime > now : false;

            const stakeInfo: StakeInfo = {
              address,
              amount,
              unlockTime,
              isLocked
            };

            results.set(address, stakeInfo);
            this.stakesCache.set(lowerAddr, stakeInfo);
          }
        }
      } catch (e) {
        console.error(`[AnalyticsService] Error fetching stake for ${address}:`, e);
      }
    }

    if (needsRefresh) {
      this.stakesLastUpdated = now;
    }

    return results;
  }

  /**
   * Get cache status
   */
  getCacheStatus(): {
    staking: { cached: boolean; age: number | null };
    nodeRegistry: { cached: boolean; age: number | null };
  } {
    const now = Date.now();
    return {
      staking: {
        cached: !!this.stakingCache,
        age: this.stakingCache ? now - this.stakingCache.lastUpdated : null
      },
      nodeRegistry: {
        cached: !!this.nodeRegistryCache,
        age: this.nodeRegistryCache ? now - this.nodeRegistryCache.lastUpdated : null
      }
    };
  }

  /**
   * Initialize cache on startup - pre-fetches all data
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[AnalyticsService] Already initialized');
      return;
    }

    console.log('[AnalyticsService] Initializing - pre-caching analytics data...');

    try {
      // Fetch all data in parallel
      await Promise.all([
        this.getStakingData(true),
        this.getNodeRegistryData(true)
      ]);

      // Also pre-fetch stakes for registered nodes
      if (this.nodeRegistryCache && this.nodeRegistryCache.nodes.length > 0) {
        const addresses = this.nodeRegistryCache.nodes.map(n => n.address);
        await this.getStakesForAddresses(addresses, true);
      }

      console.log('[AnalyticsService] Initialization complete');
    } catch (error) {
      console.error('[AnalyticsService] Initialization error:', error);
    }

    // Start auto-refresh timer
    this.startAutoRefresh();
    this.initialized = true;
  }

  /**
   * Start auto-refresh timer to keep cache fresh
   */
  private startAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }

    console.log(`[AnalyticsService] Starting auto-refresh every ${AUTO_REFRESH_INTERVAL / 1000}s`);

    this.autoRefreshTimer = setInterval(async () => {
      const now = Date.now();

      // Refresh staking data if stale
      if (!this.stakingCache || (now - this.stakingCache.lastUpdated) >= AUTO_REFRESH_INTERVAL) {
        console.log('[AnalyticsService] Auto-refreshing staking data...');
        await this.getStakingData(true);
      }

      // Refresh node registry data if stale
      if (!this.nodeRegistryCache || (now - this.nodeRegistryCache.lastUpdated) >= AUTO_REFRESH_INTERVAL) {
        console.log('[AnalyticsService] Auto-refreshing node registry data...');
        await this.getNodeRegistryData(true);
      }

      // Refresh stakes if stale
      if (this.nodeRegistryCache && (now - this.stakesLastUpdated) >= AUTO_REFRESH_INTERVAL) {
        console.log('[AnalyticsService] Auto-refreshing stakes data...');
        const addresses = this.nodeRegistryCache.nodes.map(n => n.address);
        await this.getStakesForAddresses(addresses, true);
      }
    }, AUTO_REFRESH_INTERVAL);
  }

  /**
   * Stop auto-refresh timer (for cleanup)
   */
  stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
      console.log('[AnalyticsService] Auto-refresh stopped');
    }
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
export default analyticsService;
