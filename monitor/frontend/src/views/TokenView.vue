<template>
  <div class="space-y-6">
    <!-- Error State -->
    <div v-if="error" class="card bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
      <div class="flex items-center gap-3 text-red-700 dark:text-red-400">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div>
          <p class="font-medium">Error loading token data</p>
          <p class="text-sm opacity-80">{{ error }}</p>
        </div>
        <button @click="refreshData" class="ml-auto px-3 py-1 bg-red-100 dark:bg-red-800/50 rounded hover:bg-red-200 dark:hover:bg-red-700/50">
          Retry
        </button>
      </div>
    </div>

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

        <div class="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800/50 relative group">
          <div class="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            Total Burned
            <svg class="w-3.5 h-3.5 opacity-50 cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="text-2xl font-bold text-orange-700 dark:text-orange-400">
            {{ formatLargeNumber(metrics?.totalBurnedFormatted || 0) }}
          </div>
          <div class="text-sm text-orange-600 dark:text-orange-400/80">
            {{ metrics?.burnCount || 0 }} burn events
          </div>
          <div class="absolute hidden group-hover:block z-10 bottom-full left-0 mb-2 w-64 p-2 text-xs bg-slate-900 text-slate-200 rounded shadow-lg">
            Direct on-chain burns to 0x0 and 0xdead addresses. Does not include bonding curve retires.
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

    <!-- Burn Statistics Cards -->
    <div class="card">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4">Burn Statistics</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800/50">
          <div class="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">24h Burned</div>
          <div class="text-xl font-bold text-orange-700 dark:text-orange-400">
            {{ formatLargeNumber(metrics?.last24hBurned || 0) }}
          </div>
          <div class="text-sm text-orange-600/80 dark:text-orange-400/60">TRU</div>
        </div>
        <div class="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800/50">
          <div class="text-xs text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">7d Burned</div>
          <div class="text-xl font-bold text-orange-700 dark:text-orange-400">
            {{ formatLargeNumber(metrics?.last7dBurned || 0) }}
          </div>
          <div class="text-sm text-orange-600/80 dark:text-orange-400/60">TRU</div>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Avg per Burn</div>
          <div class="text-xl font-bold text-gray-900 dark:text-cyan-400">
            {{ formatLargeNumber(avgBurnAmount) }}
          </div>
          <div class="text-sm text-gray-500 dark:text-slate-500">TRU</div>
        </div>
        <div class="p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg">
          <div class="text-xs text-gray-500 dark:text-slate-500 uppercase tracking-wide mb-1">Last Burn</div>
          <div class="text-xl font-bold text-gray-900 dark:text-cyan-400">
            {{ metrics?.lastBurnTimestamp ? timeAgo(metrics.lastBurnTimestamp) : 'N/A' }}
          </div>
          <div class="text-sm text-gray-500 dark:text-slate-500">ago</div>
        </div>
      </div>
    </div>

    <!-- Burn History Chart -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400">Burn Activity</h2>
        <div class="flex items-center gap-4">
          <!-- Chart Type Toggle -->
          <div class="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              @click="chartType = 'cumulative'"
              :class="chartType === 'cumulative' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''"
              class="px-3 py-1 text-xs rounded-md transition-colors text-gray-700 dark:text-slate-300"
            >
              Cumulative
            </button>
            <button
              @click="chartType = 'daily'"
              :class="chartType === 'daily' ? 'bg-white dark:bg-slate-700 shadow-sm' : ''"
              class="px-3 py-1 text-xs rounded-md transition-colors text-gray-700 dark:text-slate-300"
            >
              Daily
            </button>
          </div>
          <!-- Time Filter -->
          <div class="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              v-for="filter in timeFilters"
              :key="filter.value"
              @click="selectedTimeFilter = filter.value"
              :class="selectedTimeFilter === filter.value ? 'bg-white dark:bg-slate-700 shadow-sm' : ''"
              class="px-2 py-1 text-xs rounded-md transition-colors text-gray-700 dark:text-slate-300"
            >
              {{ filter.label }}
            </button>
          </div>
        </div>
      </div>
      <div v-if="filteredChartData.length > 0" class="h-64">
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

    <!-- Full Burn History -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400">Burn History</h2>
        <div class="flex items-center gap-4">
          <span class="text-sm text-gray-500 dark:text-slate-500">{{ filteredBurns.length }} of {{ allBurns.length }} events</span>
          <button
            @click="exportBurnsCSV"
            class="px-3 py-1 text-xs bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      <!-- Search and Filter -->
      <div class="flex flex-wrap gap-3 mb-4">
        <div class="flex-1 min-w-[200px]">
          <input
            v-model="burnSearch"
            type="text"
            placeholder="Search by address or tx hash..."
            class="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 text-gray-900 dark:text-slate-200"
          />
        </div>
        <select
          v-model="burnTypeFilter"
          class="px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded focus:outline-none focus:ring-1 focus:ring-cyan-500 text-gray-900 dark:text-slate-200"
        >
          <option value="">All burn types</option>
          <option value="null">0x0 (Null address)</option>
          <option value="dead">0xdead</option>
        </select>
      </div>

      <div v-if="filteredBurns.length > 0" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-slate-700">
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Date</th>
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Block</th>
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">From</th>
              <th class="text-left py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">To</th>
              <th class="text-right py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Amount</th>
              <th class="text-center py-2 px-3 text-gray-600 dark:text-slate-400 font-medium">Tx</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-slate-800">
            <tr v-for="burn in paginatedBurns" :key="`${burn.txHash}-${burn.logIndex}`" class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
              <td class="py-2 px-3 text-gray-600 dark:text-slate-400 text-xs whitespace-nowrap">
                {{ formatDate(burn.date) }}
              </td>
              <td class="py-2 px-3 font-mono text-xs text-gray-500 dark:text-slate-500">
                {{ burn.blockNumber?.toLocaleString() }}
              </td>
              <td class="py-2 px-3">
                <a
                  :href="`https://etherscan.io/address/${burn.from}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="font-mono text-xs text-blue-600 dark:text-cyan-400 hover:underline"
                >
                  {{ formatAddress(burn.from) }}
                </a>
              </td>
              <td class="py-2 px-3">
                <span
                  :class="burn.burnType === 'null' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'"
                  class="px-1.5 py-0.5 rounded text-xs font-medium"
                >
                  {{ burn.burnType === 'null' ? '0x0' : '0xdead' }}
                </span>
              </td>
              <td class="py-2 px-3 text-right font-mono text-orange-600 dark:text-orange-400">
                {{ formatNumber(burn.amountFormatted, 2) }} TRU
              </td>
              <td class="py-2 px-3 text-center">
                <a
                  :href="`https://etherscan.io/tx/${burn.txHash}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-blue-600 dark:text-cyan-400 hover:underline"
                  title="View transaction on Etherscan"
                >
                  <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center text-gray-500 dark:text-slate-500 py-8">
        {{ loading ? 'Loading burn history...' : 'No burns recorded' }}
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
        <div class="text-sm text-gray-500 dark:text-slate-500">
          Showing {{ (currentPage - 1) * pageSize + 1 }}-{{ Math.min(currentPage * pageSize, filteredBurns.length) }} of {{ filteredBurns.length }}
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="currentPage = 1"
            :disabled="currentPage === 1"
            class="px-2 py-1 text-sm rounded border border-gray-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
          >
            First
          </button>
          <button
            @click="currentPage--"
            :disabled="currentPage === 1"
            class="px-3 py-1 text-sm rounded border border-gray-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
          >
            Prev
          </button>
          <span class="px-3 py-1 text-sm text-gray-600 dark:text-slate-400">
            {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            @click="currentPage++"
            :disabled="currentPage === totalPages"
            class="px-3 py-1 text-sm rounded border border-gray-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
          >
            Next
          </button>
          <button
            @click="currentPage = totalPages"
            :disabled="currentPage === totalPages"
            class="px-2 py-1 text-sm rounded border border-gray-300 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300"
          >
            Last
          </button>
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
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
  last24hBurned?: number;
  last7dBurned?: number;
  lastBurnTimestamp?: number;
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
  to?: string;
  amountFormatted: number;
  date: string;
  blockNumber?: number;
  logIndex?: number;
  burnType?: 'null' | 'dead';
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
const error = ref<string | null>(null);
const metrics = ref<TokenMetrics | null>(null);
const tokenInfo = ref<TokenInfo | null>(null);
const burns = ref<BurnEntry[]>([]);
const allBurns = ref<BurnEntry[]>([]);
const leaderboard = ref<LeaderboardEntry[]>([]);
const chartData = ref<ChartDataPoint[]>([]);
const chartCanvas = ref<HTMLCanvasElement | null>(null);
let chartInstance: Chart | null = null;

// Pagination
const currentPage = ref(1);
const pageSize = 20;

// Search and filters
const burnSearch = ref('');
const burnTypeFilter = ref('');

// Chart controls
const chartType = ref<'cumulative' | 'daily'>('cumulative');
const selectedTimeFilter = ref<string>('all');
const timeFilters = [
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: 'All', value: 'all' }
];

// Computed values
const filteredChartData = computed(() => {
  if (chartData.value.length === 0) return [];

  const now = new Date();
  let cutoffDate: Date;

  switch (selectedTimeFilter.value) {
    case '1m':
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3m':
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '6m':
      cutoffDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      cutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      break;
    default:
      return chartData.value;
  }

  return chartData.value.filter(d => new Date(d.date) >= cutoffDate);
});

const avgBurnAmount = computed(() => {
  if (!metrics.value?.burnCount || metrics.value.burnCount === 0) return 0;
  return (metrics.value.totalBurnedFormatted || 0) / metrics.value.burnCount;
});

const filteredBurns = computed(() => {
  let result = allBurns.value;

  if (burnSearch.value) {
    const search = burnSearch.value.toLowerCase();
    result = result.filter(b =>
      b.from.toLowerCase().includes(search) ||
      b.txHash.toLowerCase().includes(search)
    );
  }

  if (burnTypeFilter.value) {
    result = result.filter(b => b.burnType === burnTypeFilter.value);
  }

  return result;
});

const totalPages = computed(() => Math.ceil(filteredBurns.value.length / pageSize));

const paginatedBurns = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredBurns.value.slice(start, start + pageSize);
});

// Watch for chart control changes
watch([chartType, selectedTimeFilter], () => {
  nextTick(() => renderChart());
});

// Reset pagination when filters change
watch([burnSearch, burnTypeFilter], () => {
  currentPage.value = 1;
});

const API_BASE = import.meta.env.VITE_TOKEN_API_URL || '/api/token';

async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    // Helper to safely parse JSON response
    const safeJson = async (res: Response) => {
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const text = await res.text();
      if (!text) {
        throw new Error('Empty response from server');
      }
      return JSON.parse(text);
    };

    const [metricsRes, infoRes, burnsRes, allBurnsRes, leaderboardRes, chartRes] = await Promise.all([
      fetch(`${API_BASE}/metrics`),
      fetch(`${API_BASE}/info`),
      fetch(`${API_BASE}/burns?limit=10`),
      fetch(`${API_BASE}/burns?limit=1000`), // Get all burns for paginated table
      fetch(`${API_BASE}/leaderboard?limit=10`),
      fetch(`${API_BASE}/burns/chart`)
    ]);

    const [metricsData, infoData, burnsData, allBurnsData, leaderboardData, chartDataRes] = await Promise.all([
      safeJson(metricsRes),
      safeJson(infoRes),
      safeJson(burnsRes),
      safeJson(allBurnsRes),
      safeJson(leaderboardRes),
      safeJson(chartRes)
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
    if (allBurnsData.success) {
      allBurns.value = allBurnsData.data.burns;
    }
    if (leaderboardData.success) {
      leaderboard.value = leaderboardData.data;
    }
    if (chartDataRes.success) {
      chartData.value = chartDataRes.data;
      await nextTick();
      renderChart();
    }
  } catch (err) {
    console.error('Error fetching token data:', err);
    const message = err instanceof Error ? err.message : 'Failed to load token data';
    // Provide user-friendly error message
    if (message.includes('Empty response') || message.includes('Server returned')) {
      error.value = 'Backend server is not running. Token analytics requires the monitor backend to be active.';
    } else {
      error.value = message;
    }
  } finally {
    loading.value = false;
  }
}

async function refreshData() {
  await fetchData();
}

function renderChart() {
  if (!chartCanvas.value || filteredChartData.value.length === 0) return;

  if (chartInstance) {
    chartInstance.destroy();
  }

  const ctx = chartCanvas.value.getContext('2d');
  if (!ctx) return;

  const isDark = document.documentElement.classList.contains('dark');
  const data = filteredChartData.value;

  if (chartType.value === 'daily') {
    // Bar chart for daily burns
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.date),
        datasets: [
          {
            label: 'Daily Burned (TRU)',
            data: data.map(d => d.dailyBurned),
            backgroundColor: isDark ? 'rgba(249, 115, 22, 0.7)' : 'rgba(234, 88, 12, 0.7)',
            borderColor: isDark ? '#f97316' : '#ea580c',
            borderWidth: 1,
            borderRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${formatLargeNumber(context.parsed.y ?? 0)} TRU burned`
            }
          }
        },
        scales: {
          x: {
            grid: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)' },
            ticks: { color: isDark ? '#94a3b8' : '#64748b', maxTicksLimit: 8 }
          },
          y: {
            grid: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)' },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              callback: (value) => formatLargeNumber(value as number)
            }
          }
        }
      }
    });
  } else {
    // Line chart for cumulative burns
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.date),
        datasets: [
          {
            label: 'Cumulative Burned (TRU)',
            data: data.map(d => d.cumulativeBurned),
            borderColor: isDark ? '#f97316' : '#ea580c',
            backgroundColor: isDark ? 'rgba(249, 115, 22, 0.1)' : 'rgba(234, 88, 12, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: data.length > 50 ? 0 : 3,
            pointHoverRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${formatLargeNumber(context.parsed.y ?? 0)} TRU burned`
            }
          }
        },
        scales: {
          x: {
            grid: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)' },
            ticks: { color: isDark ? '#94a3b8' : '#64748b', maxTicksLimit: 8 }
          },
          y: {
            grid: { color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(0, 0, 0, 0.05)' },
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              callback: (value) => formatLargeNumber(value as number)
            }
          }
        }
      }
    });
  }
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

function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function exportBurnsCSV() {
  if (allBurns.value.length === 0) return;

  const headers = ['Date', 'Block', 'From', 'To', 'Amount (TRU)', 'Burn Type', 'Tx Hash'];
  const rows = allBurns.value.map(burn => [
    new Date(burn.date).toISOString(),
    burn.blockNumber?.toString() || '',
    burn.from,
    burn.to || '',
    burn.amountFormatted.toFixed(2),
    burn.burnType || '',
    burn.txHash
  ]);

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `tru-burns-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
