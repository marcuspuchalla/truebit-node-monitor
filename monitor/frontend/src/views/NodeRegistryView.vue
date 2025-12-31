<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-cyan-400 mb-2">Node Registry</h1>
          <p class="text-sm text-gray-600 dark:text-slate-400">
            Registered Truebit nodes on Avalanche C-Chain
          </p>
        </div>
        <div class="flex items-center gap-3">
          <a
            :href="`https://snowtrace.io/address/${REGISTRY_ADDRESS}`"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors flex items-center gap-1"
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
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Total Nodes</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-cyan-400">{{ nodes.length }}</div>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Network</div>
          <div class="text-2xl font-bold text-red-600 dark:text-red-400">Avalanche</div>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">First Registration</div>
          <div class="text-lg font-bold text-gray-900 dark:text-cyan-400">{{ formatDate(earliestRegistration) }}</div>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Latest Registration</div>
          <div class="text-lg font-bold text-gray-900 dark:text-cyan-400">{{ formatDate(latestRegistration) }}</div>
        </div>
      </div>

      <!-- Contract Info -->
      <div class="p-3 bg-slate-50 dark:bg-slate-800/30 rounded text-sm mb-6">
        <span class="text-gray-600 dark:text-slate-400">Contract:</span>
        <a
          :href="`https://snowtrace.io/address/${REGISTRY_ADDRESS}`"
          target="_blank"
          rel="noopener noreferrer"
          class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline ml-2"
        >
          {{ REGISTRY_ADDRESS }}
        </a>
      </div>
    </div>

    <!-- Check Address -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4">Check Registration</h2>
      <div class="flex gap-3">
        <input
          v-model="checkAddress"
          type="text"
          placeholder="Enter address to check..."
          class="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500 text-gray-900 dark:text-slate-200 font-mono"
        />
        <button
          @click="checkRegistration"
          :disabled="checkLoading || !checkAddress"
          class="px-4 py-2 text-sm bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors disabled:opacity-50"
        >
          {{ checkLoading ? 'Checking...' : 'Check' }}
        </button>
      </div>
      <div v-if="checkResult !== null" class="mt-3 p-3 rounded" :class="checkResult.isRegistered ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'">
        <span class="font-medium">{{ checkResult.isRegistered ? 'Registered' : 'Not Registered' }}</span>
        <span v-if="checkResult.isRegistered" class="ml-2 text-sm opacity-80">
          (Index: {{ checkResult.nodeIndex }}, Block: {{ checkResult.blockRegistered?.toLocaleString() }})
        </span>
      </div>
    </div>

    <!-- Registered Nodes List -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4">Registered Nodes</h2>

      <div v-if="loading" class="text-center py-8 text-gray-500 dark:text-slate-500">
        Loading nodes...
      </div>

      <div v-else-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded">
        {{ error }}
      </div>

      <div v-else-if="sortedNodes.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-slate-700">
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">#</th>
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Node Address</th>
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Block Registered</th>
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Registered At</th>
              <th class="text-right py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Stake</th>
              <th class="text-center py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Links</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
            <tr v-for="node in sortedNodes" :key="node.address" class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
              <td class="py-3 px-3 text-gray-500 dark:text-slate-500">{{ node.nodeIndex }}</td>
              <td class="py-3 px-3">
                <a
                  :href="`https://snowtrace.io/address/${node.address}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline"
                >
                  {{ node.address }}
                </a>
              </td>
              <td class="py-3 px-3 font-mono text-gray-600 dark:text-slate-400">
                {{ node.blockRegistered?.toLocaleString() || 'N/A' }}
              </td>
              <td class="py-3 px-3 text-gray-600 dark:text-slate-400">
                {{ node.timestampRegistered ? formatDateTime(node.timestampRegistered) : 'N/A' }}
              </td>
              <td class="py-3 px-3 text-right font-mono text-gray-600 dark:text-slate-400">
                {{ formatStake(getStakeAmount(node.address)) }}
              </td>
              <td class="py-3 px-3 text-center">
                <a
                  :href="`https://snowtrace.io/address/${node.address}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1"
                  title="View on Snowtrace"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="text-center py-8 text-gray-500 dark:text-slate-500">
        No registered nodes found
      </div>

      <!-- Last Updated -->
      <div v-if="lastUpdated" class="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-500 dark:text-slate-500 text-right">
        Data cached • Last updated: {{ formatLastUpdated(lastUpdated) }}
      </div>
    </div>

    <!-- Inactive Nodes Section -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400">Previously Registered Nodes</h2>
        <button
          @click="fetchInactiveNodes"
          :disabled="inactiveNodesLoading"
          class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <svg v-if="!showInactiveNodes" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
          <svg v-else class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
          {{ inactiveNodesLoading ? 'Loading...' : (showInactiveNodes ? 'Hide' : 'Show') }}
        </button>
      </div>

      <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
        Nodes that were previously registered but are no longer active in the registry.
      </p>

      <div v-if="showInactiveNodes && inactiveNodes.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-slate-700">
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Node Address</th>
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Block Registered</th>
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Registered At</th>
              <th class="text-center py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Status</th>
              <th class="text-center py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Links</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
            <tr v-for="node in inactiveNodes" :key="node.address" class="hover:bg-gray-50 dark:hover:bg-slate-800/50 opacity-60">
              <td class="py-3 px-3">
                <a
                  :href="`https://snowtrace.io/address/${node.address}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono text-xs text-gray-500 dark:text-slate-500 hover:underline"
                >
                  {{ node.address }}
                </a>
              </td>
              <td class="py-3 px-3 font-mono text-gray-500 dark:text-slate-500">
                {{ node.blockRegistered?.toLocaleString() || 'N/A' }}
              </td>
              <td class="py-3 px-3 text-gray-500 dark:text-slate-500">
                {{ node.timestampRegistered ? formatDateTime(node.timestampRegistered) : 'N/A' }}
              </td>
              <td class="py-3 px-3 text-center">
                <span class="px-2 py-0.5 text-xs rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  Inactive
                </span>
              </td>
              <td class="py-3 px-3 text-center">
                <a
                  :href="`https://snowtrace.io/address/${node.address}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-gray-400 dark:text-slate-600 hover:text-gray-600 dark:hover:text-slate-400 inline-flex items-center gap-1"
                  title="View on Snowtrace"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="mt-3 text-xs text-gray-500 dark:text-slate-500">
          {{ inactiveNodes.length }} previously registered node{{ inactiveNodes.length !== 1 ? 's' : '' }} no longer active
        </div>
      </div>

      <div v-else-if="showInactiveNodes && inactiveNodes.length === 0" class="text-center py-4 text-gray-500 dark:text-slate-500">
        No inactive nodes found
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useNodeRegistry, type HistoricalNode } from '../composables/useNodeRegistry';
import { useStaking, type StakeInfo } from '../composables/useStaking';
import { useAnalyticsApi } from '../composables/useAnalyticsApi';

const REGISTRY_ADDRESS = '0x67AF2F01D7cb9A52af289b2702772576bd155310';

const nodeRegistry = useNodeRegistry();
const staking = useStaking();
const analyticsApi = useAnalyticsApi();

interface NodeInfo {
  address: string;
  isRegistered: boolean;
  nodeIndex?: number;
  blockRegistered?: number;
  timestampRegistered?: Date;
}

const nodes = ref<NodeInfo[]>([]);
const inactiveNodes = ref<HistoricalNode[]>([]);
const showInactiveNodes = ref(false);
const inactiveNodesLoading = ref(false);
const stakes = ref<Map<string, StakeInfo>>(new Map());
const checkAddress = ref('');
const checkLoading = ref(false);
const checkResult = ref<NodeInfo | null>(null);
const lastUpdated = ref<number | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

// Sort nodes by block registered (newest first)
const sortedNodes = computed(() => {
  return [...nodes.value].sort((a, b) => {
    const blockA = a.blockRegistered ?? 0;
    const blockB = b.blockRegistered ?? 0;
    return blockB - blockA;
  });
});

// Fetch stakes for all nodes after nodes are loaded
async function fetchStakes() {
  if (nodes.value.length === 0) return;
  const addresses = nodes.value.map(n => n.address);
  // Try API first, fallback to direct blockchain
  const apiStakes = await analyticsApi.getStakesForAddresses(addresses);
  if (apiStakes.size > 0) {
    stakes.value = apiStakes;
  } else {
    stakes.value = await staking.getMultipleStakes(addresses);
  }
}

function getStakeAmount(address: string): number | null {
  const stake = stakes.value.get(address);
  return stake?.amount ?? null;
}

function formatStake(amount: number | null): string {
  if (amount === null) return '—';
  if (amount === 0) return '0';
  return amount.toLocaleString() + ' TRU';
}

const earliestRegistration = computed(() => {
  const timestamps = nodes.value
    .map(n => n.timestampRegistered)
    .filter((t): t is Date => t !== undefined);
  if (timestamps.length === 0) return null;
  return new Date(Math.min(...timestamps.map(t => t.getTime())));
});

const latestRegistration = computed(() => {
  const timestamps = nodes.value
    .map(n => n.timestampRegistered)
    .filter((t): t is Date => t !== undefined);
  if (timestamps.length === 0) return null;
  return new Date(Math.max(...timestamps.map(t => t.getTime())));
});

async function refreshData(forceRefresh = false) {
  // Check localStorage cache first (unless forcing refresh)
  if (!forceRefresh) {
    const cachedNodes = analyticsApi.getCachedNodeRegistryData();
    if (cachedNodes && cachedNodes.nodes.length > 0) {
      nodes.value = cachedNodes.nodes.map((n, index) => ({
        address: n.address,
        isRegistered: true,
        nodeIndex: index,
        blockRegistered: n.blockRegistered,
        timestampRegistered: n.timestampRegistered ? new Date(n.timestampRegistered * 1000) : undefined
      }));
      lastUpdated.value = analyticsApi.getNodesCacheTimestamp() || Date.now();
      await fetchStakes();
      return; // Use cached data, no loading needed
    }
  }

  loading.value = true;
  error.value = null;

  try {
    // Try backend API first
    const data = await analyticsApi.getNodeRegistryData(forceRefresh);
    if (data && data.nodes.length > 0) {
      nodes.value = data.nodes.map((n, index) => ({
        address: n.address,
        isRegistered: true,
        nodeIndex: index,
        blockRegistered: n.blockRegistered,
        timestampRegistered: n.timestampRegistered ? new Date(n.timestampRegistered * 1000) : undefined
      }));
      lastUpdated.value = data.lastUpdated;
      analyticsApi.cacheNodeRegistryData(data);
    } else {
      // Fallback to direct blockchain calls
      const allNodes = await nodeRegistry.getAllNodes();
      nodes.value = allNodes;
      lastUpdated.value = Date.now();
      // Cache the fallback data too
      const cacheData = {
        nodeCount: allNodes.length,
        nodes: allNodes.map(n => ({
          address: n.address,
          blockRegistered: n.blockRegistered || 0,
          timestampRegistered: n.timestampRegistered ? Math.floor(n.timestampRegistered.getTime() / 1000) : 0,
          registeredAt: n.timestampRegistered?.toISOString() || null
        })),
        lastUpdated: Date.now(),
        network: 'avalanche',
        contract: REGISTRY_ADDRESS
      };
      analyticsApi.cacheNodeRegistryData(cacheData);
    }
  } catch (e) {
    // Fallback to direct blockchain calls on API error
    try {
      const allNodes = await nodeRegistry.getAllNodes();
      nodes.value = allNodes;
      lastUpdated.value = Date.now();
      // Cache the fallback data too
      const cacheData = {
        nodeCount: allNodes.length,
        nodes: allNodes.map(n => ({
          address: n.address,
          blockRegistered: n.blockRegistered || 0,
          timestampRegistered: n.timestampRegistered ? Math.floor(n.timestampRegistered.getTime() / 1000) : 0,
          registeredAt: n.timestampRegistered?.toISOString() || null
        })),
        lastUpdated: Date.now(),
        network: 'avalanche',
        contract: REGISTRY_ADDRESS
      };
      analyticsApi.cacheNodeRegistryData(cacheData);
    } catch (fallbackError) {
      error.value = fallbackError instanceof Error ? fallbackError.message : 'Failed to load data';
    }
  } finally {
    loading.value = false;
  }

  await fetchStakes();
}

function formatLastUpdated(timestamp: number): string {
  return analyticsApi.formatLastUpdated(timestamp);
}

async function checkRegistration() {
  if (!checkAddress.value) return;
  checkLoading.value = true;
  checkResult.value = null;
  try {
    checkResult.value = await nodeRegistry.checkRegistration(checkAddress.value);
  } finally {
    checkLoading.value = false;
  }
}

function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function fetchInactiveNodes() {
  if (inactiveNodes.value.length > 0) {
    // Already loaded, just toggle visibility
    showInactiveNodes.value = !showInactiveNodes.value;
    return;
  }

  inactiveNodesLoading.value = true;
  try {
    const inactive = await nodeRegistry.getInactiveNodes(nodes.value);
    inactiveNodes.value = inactive.sort((a, b) => b.blockRegistered - a.blockRegistered);
    showInactiveNodes.value = true;
  } catch (e) {
    console.error('Failed to fetch inactive nodes:', e);
  } finally {
    inactiveNodesLoading.value = false;
  }
}

onMounted(() => {
  refreshData();
});
</script>
