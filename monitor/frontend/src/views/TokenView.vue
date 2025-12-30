<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="card">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-gray-900 dark:text-cyan-400 mb-2">TRU Token Analytics</h1>
          <p class="text-sm text-gray-600 dark:text-slate-400">
            Real-time token metrics, burn history, and holder statistics
          </p>
        </div>
        <a
          :href="tokenInfo?.links?.etherscan"
          target="_blank"
          rel="noopener noreferrer"
          class="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors flex items-center gap-1"
        >
          <span>View on Etherscan</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      <!-- Metrics Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Price</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-cyan-400">
            ${{ formatNumber(metrics?.price || 0, 4) }}
          </div>
          <div :class="(metrics?.priceChange24h ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'" class="text-sm">
            {{ (metrics?.priceChange24h ?? 0) >= 0 ? '+' : '' }}{{ formatNumber(metrics?.priceChange24h ?? 0, 2) }}%
          </div>
        </div>

        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Market Cap</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-cyan-400">
            ${{ formatLargeNumber(metrics?.marketCap || 0) }}
          </div>
          <div class="text-sm text-gray-500 dark:text-slate-500">
            Vol: ${{ formatLargeNumber(metrics?.volume24h || 0) }}
          </div>
        </div>

        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Holders</div>
          <div class="text-2xl font-bold text-gray-900 dark:text-cyan-400">
            {{ formatNumber(metrics?.holderCount || 0, 0) }}
          </div>
          <div class="text-sm text-gray-500 dark:text-slate-500">
            addresses
          </div>
        </div>

        <div class="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800/50">
          <div class="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">Total Burned</div>
          <div class="text-2xl font-bold text-orange-700 dark:text-orange-400">
            {{ formatLargeNumber(metrics?.totalBurnedFormatted || 0) }}
          </div>
          <div class="text-sm text-orange-600 dark:text-orange-400/80">
            {{ metrics?.burnCount || 0 }} burn events
          </div>
        </div>
      </div>

      <!-- Supply Info -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-2">Supply Distribution</div>
          <div class="space-y-2">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-slate-400">Total Supply</span>
              <span class="font-mono text-gray-900 dark:text-slate-200">{{ formatLargeNumber(metrics?.totalSupplyFormatted || 0) }} TRU</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-slate-400">Circulating</span>
              <span class="font-mono text-gray-900 dark:text-slate-200">{{ formatLargeNumber(metrics?.circulatingSupplyFormatted || 0) }} TRU</span>
            </div>
          </div>
        </div>

        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-2">Token Info</div>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-slate-400">Contract</span>
              <a
                :href="tokenInfo?.links?.etherscan"
                target="_blank"
                rel="noopener noreferrer"
                class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline"
              >
                {{ formatAddress(tokenInfo?.contract) }}
              </a>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-slate-400">Network</span>
              <span class="text-gray-900 dark:text-slate-200">Ethereum Mainnet</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-slate-400">Decimals</span>
              <span class="text-gray-900 dark:text-slate-200">18</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Burn History Chart -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4">Burn History</h2>
      <div v-if="chartData.length > 0" class="h-64">
        <canvas ref="chartCanvas"></canvas>
      </div>
      <div v-else class="h-64 flex items-center justify-center text-gray-500 dark:text-slate-500">
        <span v-if="loading">Loading chart data...</span>
        <span v-else>No burn data available</span>
      </div>
    </div>

    <!-- Two Column Layout: Leaderboard & Recent Burns -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Burn Leaderboard -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4">Top Burners</h2>
        <div v-if="leaderboard.length > 0" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-slate-700">
                <th class="text-left py-2 px-2 text-gray-600 dark:text-slate-400 font-medium">#</th>
                <th class="text-left py-2 px-2 text-gray-600 dark:text-slate-400 font-medium">Address</th>
                <th class="text-right py-2 px-2 text-gray-600 dark:text-slate-400 font-medium">Burned</th>
                <th class="text-right py-2 px-2 text-gray-600 dark:text-slate-400 font-medium">Count</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
              <tr v-for="entry in leaderboard" :key="entry.address" class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <td class="py-2 px-2 text-gray-500 dark:text-slate-500">{{ entry.rank }}</td>
                <td class="py-2 px-2">
                  <a
                    :href="`https://etherscan.io/address/${entry.address}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline"
                  >
                    {{ formatAddress(entry.address) }}
                  </a>
                </td>
                <td class="py-2 px-2 text-right font-mono text-orange-600 dark:text-orange-400">
                  {{ formatLargeNumber(entry.totalBurnedFormatted) }}
                </td>
                <td class="py-2 px-2 text-right text-gray-600 dark:text-slate-400">
                  {{ entry.burnCount }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-center text-gray-500 dark:text-slate-500 py-8">
          {{ loading ? 'Loading...' : 'No data available' }}
        </div>
      </div>

      <!-- Recent Burns -->
      <div class="card">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4">Recent Burns</h2>
        <div v-if="burns.length > 0" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-slate-700">
                <th class="text-left py-2 px-2 text-gray-600 dark:text-slate-400 font-medium">Date</th>
                <th class="text-left py-2 px-2 text-gray-600 dark:text-slate-400 font-medium">From</th>
                <th class="text-right py-2 px-2 text-gray-600 dark:text-slate-400 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
              <tr v-for="burn in burns.slice(0, 10)" :key="burn.txHash" class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                <td class="py-2 px-2 text-gray-600 dark:text-slate-400 text-xs">
                  {{ formatDate(burn.date) }}
                </td>
                <td class="py-2 px-2">
                  <a
                    :href="`https://etherscan.io/tx/${burn.txHash}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline"
                  >
                    {{ formatAddress(burn.from) }}
                  </a>
                </td>
                <td class="py-2 px-2 text-right font-mono text-orange-600 dark:text-orange-400">
                  {{ formatNumber(burn.amountFormatted, 2) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="text-center text-gray-500 dark:text-slate-500 py-8">
          {{ loading ? 'Loading...' : 'No burns recorded' }}
        </div>
      </div>
    </div>

    <!-- Last Updated -->
    <div class="text-center text-xs text-gray-500 dark:text-slate-600">
      Last updated: {{ metrics?.lastUpdated ? new Date(metrics.lastUpdated).toLocaleString() : 'Never' }}
      <button
        @click="refreshData"
        class="ml-2 text-blue-600 dark:text-cyan-400 hover:underline"
        :disabled="loading"
      >
        {{ loading ? 'Refreshing...' : 'Refresh' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import Chart from 'chart.js/auto';

interface TokenMetrics {
  totalSupply: string;
  circulatingSupply: string;
  totalSupplyFormatted: number;
  circulatingSupplyFormatted: number;
  holderCount: number;
  totalBurned: string;
  totalBurnedFormatted: number;
  burnCount: number;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  lastUpdated: number;
}

interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  contract: string;
  network: string;
  links: {
    etherscan: string;
    coingecko: string;
    website: string;
  };
}

interface BurnEntry {
  txHash: string;
  from: string;
  amountFormatted: number;
  date: string;
}

interface LeaderboardEntry {
  rank: number;
  address: string;
  totalBurnedFormatted: number;
  burnCount: number;
}

interface ChartDataPoint {
  date: string;
  cumulativeBurned: number;
  dailyBurned: number;
}

const loading = ref(false);
const metrics = ref<TokenMetrics | null>(null);
const tokenInfo = ref<TokenInfo | null>(null);
const burns = ref<BurnEntry[]>([]);
const leaderboard = ref<LeaderboardEntry[]>([]);
const chartData = ref<ChartDataPoint[]>([]);
const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

const API_BASE = '/api/token';

async function fetchData() {
  loading.value = true;
  try {
    const [metricsRes, infoRes, burnsRes, leaderboardRes, chartRes] = await Promise.all([
      fetch(`${API_BASE}/metrics`),
      fetch(`${API_BASE}/info`),
      fetch(`${API_BASE}/burns?limit=10`),
      fetch(`${API_BASE}/leaderboard?limit=10`),
      fetch(`${API_BASE}/burns/chart`)
    ]);

    const [metricsData, infoData, burnsData, leaderboardData, chartDataRes] = await Promise.all([
      metricsRes.json(),
      infoRes.json(),
      burnsRes.json(),
      leaderboardRes.json(),
      chartRes.json()
    ]);

    if (metricsData.success) {
      metrics.value = metricsData.data;
    }
    if (infoData.success) {
      tokenInfo.value = infoData.data;
    }
    if (burnsData.success) {
      burns.value = burnsData.data.burns;
    }
    if (leaderboardData.success) {
      leaderboard.value = leaderboardData.data;
    }
    if (chartDataRes.success) {
      chartData.value = chartDataRes.data;
      await nextTick();
      renderChart();
    }
  } catch (error) {
    console.error('Error fetching token data:', error);
  } finally {
    loading.value = false;
  }
}

async function refreshData() {
  await fetchData();
}

function renderChart() {
  if (!chartCanvas.value || chartData.value.length === 0) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  const isDark = document.documentElement.classList.contains('dark');

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartData.value.map(d => d.date),
      datasets: [
        {
          label: 'Cumulative Burned (TRU)',
          data: chartData.value.map(d => d.cumulativeBurned),
          borderColor: isDark ? '#f97316' : '#ea580c',
          backgroundColor: isDark ? 'rgba(249, 115, 22, 0.1)' : 'rgba(234, 88, 12, 0.1)',
          fill: true,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => `${formatLargeNumber(context.parsed.y ?? 0)} TRU burned`
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            maxTicksLimit: 8
          }
        },
        y: {
          grid: {
            color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            color: isDark ? '#94a3b8' : '#64748b',
            callback: (value) => formatLargeNumber(value as number)
          }
        }
      }
    }
  });
}

function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatLargeNumber(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

function formatAddress(address: string | undefined): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

onMounted(() => {
  fetchData();
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>
