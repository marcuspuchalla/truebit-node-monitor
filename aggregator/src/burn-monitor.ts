/**
 * TRU Token Burn Monitor
 * Monitors Ethereum blockchain for TRU token burns in real-time
 * and syncs historical burn data from Blockscout API
 */

import { EventEmitter } from 'events';

// TRU Token Configuration
const TRU_CONTRACT = '0xf65B5C5104c4faFD4b709d9D60a185eAE063276c';
const TRU_DECIMALS = 18;

// Burn addresses
const BURN_ADDRESSES = [
  '0x0000000000000000000000000000000000000000',  // Null address
  '0x000000000000000000000000000000000000dEaD',  // Dead address
];

// Blockscout API for initial sync and fallback
const BLOCKSCOUT_API = 'https://eth.blockscout.com/api/v2';

// Transfer event topic (keccak256 of 'Transfer(address,address,uint256)')
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export interface BurnEvent {
  txHash: string;
  blockNumber: number;
  logIndex: number;
  timestamp: number;
  from: string;
  to: string;
  amount: string;
  amountFormatted: number;
  burnType: 'null' | 'dead';
}

export interface BurnStats {
  totalBurned: string;
  totalBurnedFormatted: number;
  burnCount: number;
  last24hBurned: number;
  last7dBurned: number;
  lastBurnTimestamp: number;
  lastBurnTxHash: string;
}

interface BlockscoutTransfer {
  block_number: number;
  timestamp: string;
  transaction_hash: string;
  from: { hash: string };
  to: { hash: string };
  total: { value: string; decimals: string };
  type: string;
  log_index: string;
}

interface BlockscoutTransferResponse {
  items: BlockscoutTransfer[];
  next_page_params?: {
    block_number: number;
    index: number;
    items_count: number;
  } | null;
}

export class TruBurnMonitor extends EventEmitter {
  private burns: Map<string, BurnEvent> = new Map();
  private lastSyncBlock: number = 0;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;

  constructor() {
    super();
  }

  /**
   * Format wei to TRU (18 decimals)
   */
  private formatTRU(wei: string): number {
    return parseFloat(wei) / 1e18;
  }

  /**
   * Fetch burn transfers from Blockscout API
   */
  async fetchBurnTransfers(startBlock: number = 0): Promise<BurnEvent[]> {
    const burns: BurnEvent[] = [];

    for (const burnAddress of BURN_ADDRESSES) {
      try {
        let hasMore = true;
        let nextPageParams: { block_number: number; index: number; items_count: number } | null = null;

        while (hasMore) {
          let url = `${BLOCKSCOUT_API}/addresses/${burnAddress}/token-transfers?token=${TRU_CONTRACT}&type=ERC-20`;

          if (nextPageParams) {
            url += `&block_number=${nextPageParams.block_number}&index=${nextPageParams.index}&items_count=${nextPageParams.items_count}`;
          }

          const response = await fetch(url);
          if (!response.ok) {
            console.error(`[BurnMonitor] Blockscout API error: ${response.status}`);
            break;
          }

          const data = await response.json() as BlockscoutTransferResponse;

          if (data.items && Array.isArray(data.items)) {
            for (const tx of data.items) {
              // Only include transfers TO the burn address and after startBlock
              if (tx.to.hash.toLowerCase() === burnAddress.toLowerCase() &&
                  tx.block_number > startBlock) {
                const burnType = burnAddress === BURN_ADDRESSES[0] ? 'null' : 'dead';
                burns.push({
                  txHash: tx.transaction_hash,
                  blockNumber: tx.block_number,
                  logIndex: parseInt(tx.log_index || '0'),
                  timestamp: new Date(tx.timestamp).getTime(),
                  from: tx.from.hash,
                  to: tx.to.hash,
                  amount: tx.total.value,
                  amountFormatted: this.formatTRU(tx.total.value),
                  burnType
                });
              } else if (tx.block_number <= startBlock) {
                hasMore = false;
                break;
              }
            }
          }

          if (data.next_page_params && hasMore) {
            nextPageParams = data.next_page_params;
            // Rate limit: wait 200ms between calls
            await new Promise(resolve => setTimeout(resolve, 200));
          } else {
            hasMore = false;
          }
        }
      } catch (error) {
        console.error(`[BurnMonitor] Error fetching burns to ${burnAddress}:`, error);
      }
    }

    return burns;
  }

  /**
   * Initial sync of all historical burns
   */
  async initialize(): Promise<void> {
    console.log('[BurnMonitor] Initializing - fetching historical burns...');

    try {
      const burns = await this.fetchBurnTransfers(0);

      for (const burn of burns) {
        const key = `${burn.txHash}-${burn.logIndex}`;
        this.burns.set(key, burn);
      }

      if (burns.length > 0) {
        this.lastSyncBlock = Math.max(...burns.map(b => b.blockNumber));
      }

      console.log(`[BurnMonitor] Loaded ${this.burns.size} historical burns (last block: ${this.lastSyncBlock})`);

      this.emit('initialized', { burnCount: this.burns.size });
    } catch (error) {
      console.error('[BurnMonitor] Initialization error:', error);
      throw error;
    }
  }

  /**
   * Start periodic sync (polling mode)
   */
  start(intervalMs: number = 300000): void { // Default: 5 minutes
    if (this.isRunning) return;

    this.isRunning = true;
    console.log(`[BurnMonitor] Starting periodic sync (every ${intervalMs / 1000}s)`);

    this.syncTimer = setInterval(async () => {
      await this.syncNewBurns();
    }, intervalMs);
  }

  /**
   * Stop the monitor
   */
  stop(): void {
    this.isRunning = false;

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    console.log('[BurnMonitor] Stopped');
  }

  /**
   * Sync new burns since last sync
   */
  async syncNewBurns(): Promise<{ newBurns: number; totalBurns: number }> {
    try {
      const newBurns = await this.fetchBurnTransfers(this.lastSyncBlock);
      let addedCount = 0;

      for (const burn of newBurns) {
        const key = `${burn.txHash}-${burn.logIndex}`;
        if (!this.burns.has(key)) {
          this.burns.set(key, burn);
          addedCount++;
          this.emit('burn', burn);
        }
      }

      if (newBurns.length > 0) {
        this.lastSyncBlock = Math.max(this.lastSyncBlock, ...newBurns.map(b => b.blockNumber));
      }

      if (addedCount > 0) {
        console.log(`[BurnMonitor] Synced ${addedCount} new burns (total: ${this.burns.size})`);
      }

      return { newBurns: addedCount, totalBurns: this.burns.size };
    } catch (error) {
      console.error('[BurnMonitor] Sync error:', error);
      return { newBurns: 0, totalBurns: this.burns.size };
    }
  }

  /**
   * Get all burns sorted by block number
   */
  getAllBurns(): BurnEvent[] {
    return Array.from(this.burns.values()).sort((a, b) => a.blockNumber - b.blockNumber);
  }

  /**
   * Get burn statistics
   */
  getStats(): BurnStats {
    const burns = this.getAllBurns();
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;

    let totalBurned = BigInt(0);
    let last24hBurned = 0;
    let last7dBurned = 0;
    let lastBurn: BurnEvent | null = null;

    for (const burn of burns) {
      totalBurned += BigInt(burn.amount);

      if (now - burn.timestamp <= day) {
        last24hBurned += burn.amountFormatted;
      }
      if (now - burn.timestamp <= week) {
        last7dBurned += burn.amountFormatted;
      }

      if (!lastBurn || burn.blockNumber > lastBurn.blockNumber) {
        lastBurn = burn;
      }
    }

    return {
      totalBurned: totalBurned.toString(),
      totalBurnedFormatted: Number(totalBurned) / 1e18,
      burnCount: burns.length,
      last24hBurned,
      last7dBurned,
      lastBurnTimestamp: lastBurn?.timestamp || 0,
      lastBurnTxHash: lastBurn?.txHash || ''
    };
  }

  /**
   * Get leaderboard of top burners
   */
  getLeaderboard(limit: number = 20): Array<{
    rank: number;
    address: string;
    totalBurned: string;
    totalBurnedFormatted: number;
    burnCount: number;
  }> {
    const byAddress = new Map<string, { total: bigint; count: number }>();

    for (const burn of this.burns.values()) {
      const existing = byAddress.get(burn.from) || { total: BigInt(0), count: 0 };
      existing.total += BigInt(burn.amount);
      existing.count += 1;
      byAddress.set(burn.from, existing);
    }

    const entries = Array.from(byAddress.entries())
      .map(([address, data]) => ({
        address,
        totalBurned: data.total.toString(),
        totalBurnedFormatted: Number(data.total) / 1e18,
        burnCount: data.count
      }))
      .sort((a, b) => {
        const diff = BigInt(b.totalBurned) - BigInt(a.totalBurned);
        return diff > 0 ? 1 : diff < 0 ? -1 : 0;
      })
      .slice(0, limit)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return entries;
  }

  /**
   * Get chart data for burn history
   */
  getChartData(): Array<{ date: string; cumulativeBurned: number; dailyBurned: number }> {
    const burns = this.getAllBurns();
    if (burns.length === 0) return [];

    const byDate = new Map<string, number>();

    for (const burn of burns) {
      const date = new Date(burn.timestamp).toISOString().split('T')[0];
      const existing = byDate.get(date) || 0;
      byDate.set(date, existing + burn.amountFormatted);
    }

    const dates = Array.from(byDate.keys()).sort();
    const data: Array<{ date: string; cumulativeBurned: number; dailyBurned: number }> = [];
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
   * Get recent burns
   */
  getRecentBurns(limit: number = 10): BurnEvent[] {
    return this.getAllBurns()
      .reverse()
      .slice(0, limit);
  }

  /**
   * Export burns for database persistence
   */
  exportForPersistence(): { burns: BurnEvent[]; lastBlock: number } {
    return {
      burns: this.getAllBurns(),
      lastBlock: this.lastSyncBlock
    };
  }

  /**
   * Import burns from database
   */
  importFromPersistence(burns: BurnEvent[], lastBlock: number): void {
    for (const burn of burns) {
      const key = `${burn.txHash}-${burn.logIndex}`;
      this.burns.set(key, burn);
    }
    this.lastSyncBlock = lastBlock;
    console.log(`[BurnMonitor] Imported ${burns.length} burns from persistence (last block: ${lastBlock})`);
  }
}

export default TruBurnMonitor;
