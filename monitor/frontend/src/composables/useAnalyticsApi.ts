import { ref } from 'vue';

const API_BASE = '/api/analytics';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY_STAKING = 'truebit_analytics_staking';
const CACHE_KEY_NODES = 'truebit_analytics_nodes';
const CACHE_KEY_STAKES = 'truebit_analytics_stakes';

interface CachedData<T> {
  data: T;
  timestamp: number;
}

function getFromCache<T>(key: string): T | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const parsed: CachedData<T> = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;

    if (age < CACHE_TTL) {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
}

function saveToCache<T>(key: string, data: T): void {
  try {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch {
    // Ignore storage errors
  }
}

function getCacheTimestamp(key: string): number | null {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    return parsed.timestamp || null;
  } catch {
    return null;
  }
}

export interface StakingData {
  totalStaked: number;
  lastUpdated: number;
  network: string;
  contract: string;
}

export interface NodeInfo {
  address: string;
  blockRegistered: number;
  timestampRegistered: number;
  registeredAt: string | null;
}

export interface NodeRegistryData {
  nodeCount: number;
  nodes: NodeInfo[];
  lastUpdated: number;
  network: string;
  contract: string;
}

export interface StakeInfo {
  address: string;
  amount: number;
  unlockTime: Date | null;
  isLocked: boolean;
}

export function useAnalyticsApi() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Helper to safely parse JSON response
  async function safeJson(response: Response) {
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    const text = await response.text();
    if (!text) {
      throw new Error('Empty response from server');
    }
    return JSON.parse(text);
  }

  async function getStakingData(forceRefresh = false): Promise<StakingData | null> {
    loading.value = true;
    error.value = null;

    try {
      const url = forceRefresh ? `${API_BASE}/staking?refresh=true` : `${API_BASE}/staking`;
      const response = await fetch(url);
      const result = await safeJson(response);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch staking data');
      }

      return result.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch staking data';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function getNodeRegistryData(forceRefresh = false): Promise<NodeRegistryData | null> {
    loading.value = true;
    error.value = null;

    try {
      const url = forceRefresh ? `${API_BASE}/nodes?refresh=true` : `${API_BASE}/nodes`;
      const response = await fetch(url);
      const result = await safeJson(response);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch node registry data');
      }

      return result.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch node registry data';
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function getStakesForAddresses(addresses: string[]): Promise<Map<string, StakeInfo>> {
    const results = new Map<string, StakeInfo>();

    if (addresses.length === 0) {
      return results;
    }

    try {
      const response = await fetch(`${API_BASE}/stakes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses })
      });
      const result = await safeJson(response);

      if (result.success && result.data.stakes) {
        for (const stake of result.data.stakes) {
          // Convert unlockTime from timestamp to Date
          results.set(stake.address, {
            ...stake,
            unlockTime: stake.unlockTime ? new Date(stake.unlockTime * 1000) : null
          });
        }
      }
    } catch {
      // Silently fail - will fallback to direct blockchain calls
    }

    return results;
  }

  async function getSummary(): Promise<{
    staking: { totalStaked: number; lastUpdated: number };
    nodes: { nodeCount: number; lastUpdated: number };
  } | null> {
    try {
      const response = await fetch(`${API_BASE}/summary`);
      const result = await safeJson(response);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics summary');
      }

      return result.data;
    } catch (e) {
      console.error('Failed to fetch analytics summary:', e);
      return null;
    }
  }

  function formatLastUpdated(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (minutes < 1) {
      return 'just now';
    } else if (minutes === 1) {
      return '1 minute ago';
    } else if (minutes < 60) {
      return `${minutes} minutes ago`;
    } else {
      const hours = Math.floor(minutes / 60);
      if (hours === 1) {
        return '1 hour ago';
      }
      return `${hours} hours ago`;
    }
  }

  // Get cached staking data (returns null if cache is stale/missing)
  function getCachedStakingData(): StakingData | null {
    return getFromCache<StakingData>(CACHE_KEY_STAKING);
  }

  // Get cached node registry data (returns null if cache is stale/missing)
  function getCachedNodeRegistryData(): NodeRegistryData | null {
    return getFromCache<NodeRegistryData>(CACHE_KEY_NODES);
  }

  // Get cached stakes data
  function getCachedStakes(): StakeInfo[] | null {
    return getFromCache<StakeInfo[]>(CACHE_KEY_STAKES);
  }

  // Save staking data to cache
  function cacheStakingData(data: StakingData): void {
    saveToCache(CACHE_KEY_STAKING, data);
  }

  // Save node registry data to cache
  function cacheNodeRegistryData(data: NodeRegistryData): void {
    saveToCache(CACHE_KEY_NODES, data);
  }

  // Save stakes data to cache
  function cacheStakes(stakes: StakeInfo[]): void {
    saveToCache(CACHE_KEY_STAKES, stakes);
  }

  // Get timestamp of cached staking data
  function getStakingCacheTimestamp(): number | null {
    return getCacheTimestamp(CACHE_KEY_STAKING);
  }

  // Get timestamp of cached node registry data
  function getNodesCacheTimestamp(): number | null {
    return getCacheTimestamp(CACHE_KEY_NODES);
  }

  return {
    loading,
    error,
    getStakingData,
    getNodeRegistryData,
    getStakesForAddresses,
    getSummary,
    formatLastUpdated,
    getCachedStakingData,
    getCachedNodeRegistryData,
    getCachedStakes,
    cacheStakingData,
    cacheNodeRegistryData,
    cacheStakes,
    getStakingCacheTimestamp,
    getNodesCacheTimestamp
  };
}
