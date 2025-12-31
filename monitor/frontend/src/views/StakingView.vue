<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-cyan-400 mb-2">Staking Overview</h1>
          <p class="text-sm text-gray-600 dark:text-slate-400">
            TRU staking on Ethereum mainnet
          </p>
        </div>
        <div class="flex items-center gap-3">
          <a
            :href="`https://etherscan.io/address/${STAKING_ADDRESS}`"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors flex items-center gap-1"
          >
            <span>View Contract</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <button
            @click="refreshData(true)"
            :disabled="loading"
            class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            {{ loading ? 'Loading...' : 'Refresh' }}
          </button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/50 relative group">
          <div class="text-xs text-green-600 dark:text-green-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            Total Staked
            <span class="cursor-help">
              <svg class="w-3.5 h-3.5 text-green-500 dark:text-green-400/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div class="text-2xl font-bold text-green-700 dark:text-green-400">{{ formatNumber(stats?.totalStaked || 0) }}</div>
          <div class="text-sm text-green-600/80 dark:text-green-400/60">TRU</div>
          <!-- Tooltip -->
          <div class="absolute left-0 top-full mt-2 w-72 p-3 bg-slate-800 dark:bg-slate-900 text-slate-200 text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
            <p class="mb-2"><strong>Total Staked</strong> includes all TRU deposited in the staking contract.</p>
            <p class="mb-2">This may differ from the sum of Registered Node stakes because some addresses stake TRU without registering as nodes.</p>
            <p class="text-slate-400">These could be old stakers who deregistered, or addresses that staked without intending to run a node.</p>
            <div class="absolute -top-1.5 left-4 w-3 h-3 bg-slate-800 dark:bg-slate-900 rotate-45"></div>
          </div>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Network</div>
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">Ethereum</div>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Registered Nodes</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-cyan-400">{{ stakers.length }}</div>
          <div class="text-sm text-gray-500 dark:text-slate-500">{{ formatNumber(totalKnownStaked) }} TRU</div>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Other Stakers</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-cyan-400">
            {{ formatNumber((stats?.totalStaked || 0) - totalKnownStaked) }}
          </div>
          <div class="text-sm text-gray-500 dark:text-slate-500">TRU (non-node)</div>
        </div>
      </div>

      <!-- Contract Info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded text-sm">
          <span class="text-gray-600 dark:text-slate-400">Staking Contract:</span>
          <a
            :href="`https://etherscan.io/address/${STAKING_ADDRESS}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline ml-2"
          >
            {{ STAKING_ADDRESS }}
          </a>
        </div>
        <div class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded text-sm">
          <span class="text-gray-600 dark:text-slate-400">TRU Token:</span>
          <a
            :href="`https://etherscan.io/token/${TRU_TOKEN}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline ml-2"
          >
            {{ TRU_TOKEN }}
          </a>
        </div>
      </div>
    </div>

    <!-- Check Address -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4">Check Stake</h2>
      <div class="flex gap-3">
        <input
          v-model="checkAddress"
          type="text"
          placeholder="Enter address to check stake..."
          class="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500 text-gray-900 dark:text-slate-200 font-mono"
        />
        <button
          @click="checkStake"
          :disabled="checkLoading || !checkAddress"
          class="px-4 py-2 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors disabled:opacity-50"
        >
          {{ checkLoading ? 'Checking...' : 'Check' }}
        </button>
      </div>
      <div v-if="checkResult !== null" class="mt-3 p-3 rounded" :class="checkResult.amount > 0 ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'">
        <span v-if="checkResult.amount > 0">
          <span class="font-medium">Staked: {{ formatNumber(checkResult.amount) }} TRU</span>
          <span v-if="checkResult.unlockTime" class="ml-2 text-sm opacity-80">
            ({{ checkResult.isLocked ? 'Locked until' : 'Unlocked since' }} {{ formatDate(checkResult.unlockTime) }})
          </span>
        </span>
        <span v-else class="font-medium">No stake found for this address</span>
      </div>
    </div>

    <!-- Known Stakers (from Node Registry) -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4">Registered Node Stakers</h2>
      <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
        Stake amounts for nodes registered in the Node Registry
      </p>

      <div v-if="loading" class="text-center py-8 text-gray-500 dark:text-slate-500">
        Loading stake data from Ethereum...
      </div>

      <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded">
        {{ error }}
      </div>

      <div v-else-if="stakers.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-slate-700">
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">#</th>
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Address</th>
              <th class="text-right py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Staked</th>
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Status</th>
              <th class="text-center py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Links</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
            <tr v-for="(staker, index) in stakers" :key="staker.address" class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
              <td class="py-3 px-3 text-gray-500 dark:text-slate-500">{{ index + 1 }}</td>
              <td class="py-3 px-3">
                <a
                  :href="`https://etherscan.io/address/${staker.address}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline"
                >
                  {{ formatAddress(staker.address) }}
                </a>
              </td>
              <td class="py-3 px-3 text-right font-mono text-green-600 dark:text-green-400">
                {{ formatNumber(staker.amount) }} TRU
              </td>
              <td class="py-3 px-3">
                <span
                  :class="staker.isLocked ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'"
                  class="px-1.5 py-0.5 rounded text-xs font-medium"
                >
                  {{ staker.isLocked ? 'Locked' : 'Unlocked' }}
                </span>
              </td>
              <td class="py-3 px-3 text-center">
                <a
                  :href="`https://etherscan.io/address/${staker.address}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 dark:text-cyan-400 hover:underline"
                  title="View on Etherscan"
                >
                  <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/30">
              <td colspan="2" class="py-3 px-3 font-medium text-gray-700 dark:text-slate-300">Total</td>
              <td class="py-3 px-3 text-right font-mono font-bold text-green-600 dark:text-green-400">
                {{ formatNumber(totalKnownStaked) }} TRU
              </td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text-slate-500">
        No staked nodes found
      </div>

      <!-- Last Updated -->
      <div v-if="lastUpdated" class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-500 text-right">
        Data cached • Last updated: {{ formatLastUpdated(lastUpdated) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useStaking, type StakeInfo, type StakingStats } from '../composables/useStaking';
import { useNodeRegistry } from '../composables/useNodeRegistry';
import { useAnalyticsApi } from '../composables/useAnalyticsApi';

const STAKING_ADDRESS = '0x94D2e9CC66Ac140bC5C2DE552DdFbd32f80eEe86';
const TRU_TOKEN = '0xf65B5C5104c4faFD4b709d9D60a185eAE063276c';

const { getStats, getStakeInfo, getMultipleStakes } = useStaking();
const { getAllNodes } = useNodeRegistry();
const analyticsApi = useAnalyticsApi();

const stats = ref<StakingStats | null>(null);
const stakers = ref<StakeInfo[]>([]);
const checkAddress = ref('');
const checkLoading = ref(false);
const checkResult = ref<StakeInfo | null>(null);
const lastUpdated = ref<number | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const totalKnownStaked = computed(() => {
  return stakers.value.reduce((sum, s) => sum + s.amount, 0);
});

async function refreshData(forceRefresh = false) {
  // Check localStorage cache first (unless forcing refresh)
  if (!forceRefresh) {
    const cachedStaking = analyticsApi.getCachedStakingData();
    const cachedStakes = analyticsApi.getCachedStakes();

    if (cachedStaking && cachedStakes) {
      stats.value = { totalStaked: cachedStaking.totalStaked, tokenAddress: TRU_TOKEN };
      stakers.value = cachedStakes;
      lastUpdated.value = analyticsApi.getStakingCacheTimestamp() || Date.now();
      return; // Use cached data, no loading needed
    }
  }

  loading.value = true;
  error.value = null;

  try {
    // Try backend API first
    const stakingData = await analyticsApi.getStakingData(forceRefresh);
    if (stakingData) {
      stats.value = { totalStaked: stakingData.totalStaked, tokenAddress: TRU_TOKEN };
      lastUpdated.value = stakingData.lastUpdated;
      analyticsApi.cacheStakingData(stakingData);

      // Get nodes and stakes from API
      const nodeData = await analyticsApi.getNodeRegistryData(forceRefresh);
      if (nodeData) {
        const nodeAddresses = nodeData.nodes.map(n => n.address);
        const stakesMap = await analyticsApi.getStakesForAddresses(nodeAddresses);
        const stakesArray = Array.from(stakesMap.values()).sort((a, b) => b.amount - a.amount);
        stakers.value = stakesArray;
        analyticsApi.cacheStakes(stakesArray);
      }
    } else {
      // Fallback to direct blockchain calls
      const statsData = await getStats();
      stats.value = statsData;
      lastUpdated.value = Date.now();
      analyticsApi.cacheStakingData({
        totalStaked: statsData.totalStaked,
        lastUpdated: Date.now(),
        network: 'ethereum',
        contract: STAKING_ADDRESS
      });

      const nodes = await getAllNodes();
      const nodeAddresses = nodes.map(n => n.address);
      const stakesMap = await getMultipleStakes(nodeAddresses);
      const stakesArray = Array.from(stakesMap.values()).sort((a, b) => b.amount - a.amount);
      stakers.value = stakesArray;
      analyticsApi.cacheStakes(stakesArray);
    }
  } catch (e) {
    // Fallback to direct blockchain calls on API error
    try {
      const statsData = await getStats();
      stats.value = statsData;
      lastUpdated.value = Date.now();
      analyticsApi.cacheStakingData({
        totalStaked: statsData.totalStaked,
        lastUpdated: Date.now(),
        network: 'ethereum',
        contract: STAKING_ADDRESS
      });

      const nodes = await getAllNodes();
      const nodeAddresses = nodes.map(n => n.address);
      const stakesMap = await getMultipleStakes(nodeAddresses);
      const stakesArray = Array.from(stakesMap.values()).sort((a, b) => b.amount - a.amount);
      stakers.value = stakesArray;
      analyticsApi.cacheStakes(stakesArray);
    } catch (fallbackError) {
      error.value = fallbackError instanceof Error ? fallbackError.message : 'Failed to load data';
    }
  } finally {
    loading.value = false;
  }
}

function formatLastUpdated(timestamp: number): string {
  return analyticsApi.formatLastUpdated(timestamp);
}

async function checkStake() {
  if (!checkAddress.value) return;
  checkLoading.value = true;
  checkResult.value = null;
  try {
    checkResult.value = await getStakeInfo(checkAddress.value);
  } finally {
    checkLoading.value = false;
  }
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

onMounted(() => {
  refreshData();
});
</script>
