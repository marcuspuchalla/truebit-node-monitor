<template>
  <div class="federation-view">
    <!-- Work in Progress Banner - compact -->
    <div class="wip-banner">
      Work in progress - features will change
    </div>

    <!-- Connection Status -->
    <div class="status-card" :class="statusClass">
      <div class="status-indicator" :class="statusClass"></div>
      <div class="status-info">
        <span class="status-label">{{ statusLabel }}</span>
      </div>
    </div>

    <!-- Hero Section: Globe + Key Stats Side by Side -->
    <div v-if="showGlobalPresence" class="hero-section">
      <div class="hero-globe">
        <NetworkGlobe :distribution="globeDistribution" />
      </div>
      <div class="hero-stats">
        <h2 class="hero-title">Network Status</h2>
        <div class="hero-stat">
          <div class="hero-stat-value">{{ networkStatsData.activeNodes || activePeerCount }}</div>
          <div class="hero-stat-label">Active Nodes</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value">{{ networkStatsData.totalTasks || 0 }}</div>
          <div class="hero-stat-label">Total Tasks</div>
        </div>
        <div class="hero-stat">
          <div class="hero-stat-value">{{ networkStatsData.totalNodes || 0 }}</div>
          <div class="hero-stat-label">Total Nodes</div>
        </div>
        <div class="hero-legend">
          <span>Approximate city buckets · Opt-out available</span>
        </div>
      </div>
    </div>

    <!-- Fallback stats when globe not shown -->
    <div v-else class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ networkStatsData.activeNodes || activePeerCount }}</div>
        <div class="stat-label">Active Nodes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ networkStatsData.totalTasks || 0 }}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ networkStatsData.totalNodes || 0 }}</div>
        <div class="stat-label">Total Nodes</div>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>

    <!-- On-Chain Stats -->
    <div class="stats-grid onchain">
      <div class="stat-card small onchain-stat">
        <div class="stat-value">{{ registeredNodeCount ?? '—' }}</div>
        <div class="stat-label">Registered Nodes</div>
        <div class="stat-network">Avalanche</div>
      </div>
      <div class="stat-card small onchain-stat">
        <div class="stat-value">{{ totalStakedTRU !== null ? formatNumber(totalStakedTRU) : '—' }}</div>
        <div class="stat-label">Total Staked</div>
        <div class="stat-network">Ethereum</div>
      </div>
      <router-link to="/nodes" class="stat-card small onchain-stat clickable">
        <div class="stat-icon">→</div>
        <div class="stat-label">View Registry</div>
      </router-link>
      <router-link to="/staking" class="stat-card small onchain-stat clickable">
        <div class="stat-icon">→</div>
        <div class="stat-label">View Staking</div>
      </router-link>
    </div>

    <!-- Extended Stats -->
    <div class="stats-grid secondary">
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.completedTasks || 0 }}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.failedTasks || 0 }}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.cachedTasks || 0 }}</div>
        <div class="stat-label">Cached</div>
      </div>
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.cacheHitRate?.toFixed(1) || 0 }}%</div>
        <div class="stat-label">Cache Hit</div>
      </div>
    </div>

    <!-- Throughput & Activity -->
    <div class="stats-grid secondary">
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.tasksLast24h || 0 }}</div>
        <div class="stat-label">Tasks 24h</div>
      </div>
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.invoicesLast24h || 0 }}</div>
        <div class="stat-label">Invoices 24h</div>
      </div>
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.totalInvoices || 0 }}</div>
        <div class="stat-label">Total Invoices</div>
      </div>
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.successRate?.toFixed(1) || 0 }}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
    </div>

    <!-- Network Breakdown -->
    <div class="section">
      <h2>Network Breakdown</h2>
      <div class="breakdown-grid">
        <div class="breakdown-card">
          <h3>Continents</h3>
          <div v-if="topContinents.length === 0" class="empty-mini">No data yet.</div>
          <div v-else>
            <div v-for="row in topContinents" :key="row.label" class="breakdown-row">
              <span class="row-label">{{ row.label }}</span>
              <div class="row-bar">
                <div class="row-fill" :style="{ width: row.percent + '%' }"></div>
              </div>
              <span class="row-value">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <div class="breakdown-card">
          <h3>Top Chains</h3>
          <div v-if="topChains.length === 0" class="empty-mini">No data yet.</div>
          <div v-else>
            <div v-for="row in topChains" :key="row.label" class="breakdown-row">
              <span class="row-label">{{ row.label }}</span>
              <div class="row-bar">
                <div class="row-fill" :style="{ width: row.percent + '%' }"></div>
              </div>
              <span class="row-value">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <div class="breakdown-card">
          <h3>Task Types</h3>
          <div v-if="topTaskTypes.length === 0" class="empty-mini">No data yet.</div>
          <div v-else>
            <div v-for="row in topTaskTypes" :key="row.label" class="breakdown-row">
              <span class="row-label">{{ row.label }}</span>
              <div class="row-bar">
                <div class="row-fill" :style="{ width: row.percent + '%' }"></div>
              </div>
              <span class="row-value">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <div class="breakdown-card">
          <h3>Execution Time</h3>
          <div v-if="topExecutionTimes.length === 0" class="empty-mini">No data yet.</div>
          <div v-else>
            <div v-for="row in topExecutionTimes" :key="row.label" class="breakdown-row">
              <span class="row-label">{{ row.label }}</span>
              <div class="row-bar">
                <div class="row-fill" :style="{ width: row.percent + '%' }"></div>
              </div>
              <span class="row-value">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <div class="breakdown-card">
          <h3>Gas Usage</h3>
          <div v-if="topGasUsage.length === 0" class="empty-mini">No data yet.</div>
          <div v-else>
            <div v-for="row in topGasUsage" :key="row.label" class="breakdown-row">
              <span class="row-label">{{ row.label }}</span>
              <div class="row-bar">
                <div class="row-fill" :style="{ width: row.percent + '%' }"></div>
              </div>
              <span class="row-value">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <div class="breakdown-card">
          <h3>Steps Computed</h3>
          <div v-if="topStepsComputed.length === 0" class="empty-mini">No data yet.</div>
          <div v-else>
            <div v-for="row in topStepsComputed" :key="row.label" class="breakdown-row">
              <span class="row-label">{{ row.label }}</span>
              <div class="row-bar">
                <div class="row-fill" :style="{ width: row.percent + '%' }"></div>
              </div>
              <span class="row-value">{{ row.value }}</span>
            </div>
          </div>
        </div>

        <div class="breakdown-card">
          <h3>Memory Usage</h3>
          <div v-if="topMemoryUsed.length === 0" class="empty-mini">No data yet.</div>
          <div v-else>
            <div v-for="row in topMemoryUsed" :key="row.label" class="breakdown-row">
              <span class="row-label">{{ row.label }}</span>
              <div class="row-bar">
                <div class="row-fill" :style="{ width: row.percent + '%' }"></div>
              </div>
              <span class="row-value">{{ row.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Network Activity -->
    <div class="section">
      <h2>Network Activity</h2>
      <div class="activity-list" v-if="recentMessages.length > 0">
        <div
          v-for="msg in recentMessages"
          :key="msg.id"
          class="activity-item"
          @click="openMessageModal(msg)"
        >
          <div class="activity-icon" :class="getMessageTypeClass(msg.message_type)">
            {{ getMessageIcon(msg.message_type) }}
          </div>
          <div class="activity-content">
            <div class="activity-title">{{ getMessageTitle(msg.message_type) }}</div>
            <div class="activity-meta">
              <span class="activity-node">{{ formatNodeId(msg.sender_node_id) }}</span>
              <span class="activity-time">{{ formatTime(msg.received_at) }}</span>
            </div>
            <div class="activity-details" v-if="msg.data">
              <span v-if="msg.data.status" class="detail-badge">{{ msg.data.status }}</span>
              <span v-if="msg.data.activeTasksBucket" class="detail-badge">Tasks: {{ msg.data.activeTasksBucket }}</span>
            </div>
          </div>
          <div class="activity-arrow">›</div>
        </div>
      </div>
      <div v-else class="empty-state">
        <p>No network activity yet. Events will appear here as nodes share data.</p>
      </div>
    </div>

    <!-- Active Peers -->
    <div class="section" v-if="activePeers.length > 0">
      <h2>Active Nodes</h2>
      <div class="peers-grid">
        <div v-for="peer in activePeers" :key="peer.node_id" class="peer-card" :class="{ 'my-node': isMyNode(peer) }" @click="openNodeModal(peer)">
          <div class="peer-status online"></div>
          <div class="peer-info">
            <div class="peer-id">
              {{ formatNodeId(peer.node_id) }}
              <span v-if="isMyNode(peer)" class="my-node-badge">You</span>
              <span v-if="getPeerRegistrationStatus(peer) === true" class="registered-badge" title="Registered on-chain">Registered</span>
              <span v-else-if="getPeerRegistrationStatus(peer) === false" class="unregistered-badge" title="Not registered on-chain">Unregistered</span>
            </div>
            <div class="peer-meta">
              <span class="peer-seen">Last seen: {{ formatTime(peer.last_seen) }}</span>
            </div>
          </div>
          <div class="peer-arrow">›</div>
        </div>
      </div>
    </div>

    <!-- Node Registration Checker -->
    <div class="section">
      <h2>Check Node Registration</h2>
      <div class="registration-checker">
        <div class="checker-input-group">
          <input
            v-model="addressToCheck"
            type="text"
            placeholder="Enter Ethereum address (0x...)"
            class="checker-input"
            @keyup.enter="checkAddress"
          />
          <button @click="checkAddress" :disabled="addressCheckLoading || !addressToCheck" class="checker-button">
            {{ addressCheckLoading ? 'Checking...' : 'Check' }}
          </button>
        </div>
        <div v-if="addressCheckResult" class="checker-result" :class="{ registered: addressCheckResult.isRegistered, unregistered: !addressCheckResult.isRegistered }">
          <div class="result-icon">{{ addressCheckResult.isRegistered ? '✓' : '✗' }}</div>
          <div class="result-content">
            <div class="result-status">
              {{ addressCheckResult.isRegistered ? 'Registered' : 'Not Registered' }}
            </div>
            <div class="result-address">{{ addressCheckResult.address }}</div>
            <div v-if="addressCheckResult.isRegistered && addressCheckResult.timestampRegistered" class="result-meta">
              Registered: {{ formatDateTime(addressCheckResult.timestampRegistered) }}
            </div>
          </div>
        </div>
        <div v-if="nodeRegistry.error.value" class="checker-error">
          {{ nodeRegistry.error.value }}
        </div>
        <p class="checker-hint">
          Check if an Ethereum address is registered as a TrueBit node on the Avalanche Node Registry.
        </p>
      </div>
    </div>

    <!-- Node Details Modal -->
    <div v-if="selectedNode" class="modal-overlay" @click.self="selectedNode = null">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Node Details</h3>
          <button class="modal-close" @click="selectedNode = null">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <span class="detail-label">Node ID</span>
            <span class="detail-value monospace">{{ selectedNode.node_id }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="detail-value">
              <span class="status-badge" :class="{ online: isNodeOnline(selectedNode) }">
                {{ isNodeOnline(selectedNode) ? 'Online' : 'Offline' }}
              </span>
            </span>
          </div>
          <div class="detail-row">
            <span class="detail-label">First Seen</span>
            <span class="detail-value">{{ formatDateTime(selectedNode.first_seen) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Last Seen</span>
            <span class="detail-value">{{ formatDateTime(selectedNode.last_seen) }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Messages Received</span>
            <span class="detail-value">{{ selectedNode.message_count || 0 }}</span>
          </div>
          <div class="detail-row" v-if="selectedNode.is_blocked">
            <span class="detail-label">Blocked</span>
            <span class="detail-value text-red">Yes</span>
          </div>
          <div class="detail-row" v-if="selectedNodeStats">
            <span class="detail-label">Active Tasks</span>
            <span class="detail-value">{{ selectedNodeStats.activeTasks ?? selectedNodeStats.activeTasksBucket ?? '0' }}</span>
          </div>
          <div class="detail-row" v-if="selectedNodeStats">
            <span class="detail-label">Total Tasks</span>
            <span class="detail-value">{{ selectedNodeStats.totalTasks ?? selectedNodeStats.totalTasksBucket ?? '0' }}</span>
          </div>
          <div class="detail-row" v-if="selectedNode.continent_bucket || selectedNodeStats?.continentBucket">
            <span class="detail-label">Continent</span>
            <span class="detail-value">{{ formatContinent(selectedNode.continent_bucket || selectedNodeStats?.continentBucket) }}</span>
          </div>
          <div class="detail-row" v-if="selectedNode.location_bucket || selectedNodeStats?.locationBucket">
            <span class="detail-label">Location</span>
            <span class="detail-value">{{ formatLocationBucket(selectedNode.location_bucket || selectedNodeStats?.locationBucket) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Message Details Modal -->
    <div v-if="selectedMessage" class="modal-overlay" @click.self="selectedMessage = null">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ getMessageTitle(selectedMessage.message_type) }}</h3>
          <button class="modal-close" @click="selectedMessage = null">×</button>
        </div>
        <div class="modal-body">
          <div class="detail-row">
            <span class="detail-label">Type</span>
            <span class="detail-value">{{ selectedMessage.message_type }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">From Node</span>
            <span class="detail-value monospace">{{ selectedMessage.sender_node_id }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Received</span>
            <span class="detail-value">{{ formatDateTime(selectedMessage.received_at) }}</span>
          </div>
          <div class="detail-section" v-if="selectedMessage.data">
            <h4>Event Data</h4>
            <div class="detail-row" v-for="(value, key) in selectedMessage.data" :key="key">
              <span class="detail-label">{{ formatKey(key) }}</span>
              <span class="detail-value">{{ formatValue(value) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Unofficial Community Notice -->
    <div class="unofficial-notice">
      Unofficial community monitor - not affiliated with Truebit Co.
      <router-link to="/about" class="notice-link">Learn more</router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useFederationStore } from '../stores/federation';
import NetworkGlobe from '../components/NetworkGlobe.vue';
import { useNodeRegistry } from '../composables/useNodeRegistry';
import { useStaking } from '../composables/useStaking';

const federationStore = useFederationStore();

const {
  settings,
  status,
  messages,
  peers,
  totalMessagesSent,
  totalMessagesReceived,
  activePeerCount,
  aggregatedNetworkStats
} = storeToRefs(federationStore);

// Modal state
const selectedNode = ref(null);
const selectedMessage = ref(null);

// Node registry for on-chain registration checks
const nodeRegistry = useNodeRegistry();
const registrationStatus = ref(new Map());
const addressToCheck = ref('');
const addressCheckResult = ref(null);
const addressCheckLoading = ref(false);

// On-chain stats
const staking = useStaking();
const registeredNodeCount = ref(null);
const totalStakedTRU = ref(null);

// Check registration for a single address
async function checkAddress() {
  if (!addressToCheck.value) return;
  addressCheckLoading.value = true;
  addressCheckResult.value = null;
  const result = await nodeRegistry.checkRegistration(addressToCheck.value);
  addressCheckResult.value = result;
  addressCheckLoading.value = false;
}

// Get registration status for a peer (defined early, used in template)
function getPeerRegistrationStatus(peer) {
  const status = registrationStatus.value.get(peer.node_id.toLowerCase());
  return status;
}

// Parse bucket string to get minimum value (e.g., "1-10" -> 1, "0" -> 0, ">1K" -> 1000)
function parseBucketMin(bucket) {
  if (!bucket || bucket === 'unknown') return 0;
  if (bucket === '0') return 0;
  if (bucket.startsWith('>')) {
    // Handle ">1K", ">5", etc.
    const num = bucket.slice(1).replace('K', '000').replace('M', '000000');
    return parseInt(num) || 0;
  }
  if (bucket.includes('-')) {
    // Handle "1-10", "10-50", etc.
    return parseInt(bucket.split('-')[0]) || 0;
  }
  // Handle single number like "1", "2-3"
  return parseInt(bucket) || 0;
}

// Computed network stats with fallbacks - compute from messages if aggregator data not available
const networkStatsData = computed(() => {
  const aggStats = aggregatedNetworkStats.value || {};

  // If we have aggregator data with real values, use it
  if (aggStats.status !== 'awaiting_data' && aggStats.totalTasks > 0) {
    return aggStats;
  }

  // Otherwise, compute from available data
  const nodeStats = new Map(); // Track latest stats per node
  const continentCounts = {};
  const locationCounts = {};

  // Count only ACTIVE peers (seen within last 2 minutes)
  const activeNodeIds = new Set();
  peers.value.forEach(peer => {
    if (isNodeOnline(peer)) {
      activeNodeIds.add(peer.node_id);
    }
  });

  // Get stats from heartbeat messages - track per-node to avoid duplicates
  // Only consider heartbeats from active nodes (within 2 min window)
  messages.value.forEach(msg => {
    if (msg.message_type === 'heartbeat' && msg.data && activeNodeIds.has(msg.sender_node_id)) {
      const nodeId = msg.sender_node_id;
      const existing = nodeStats.get(nodeId);
      const msgTime = new Date(msg.received_at);

      // Only update if this is a newer message
      if (!existing || msgTime > existing.time) {
        nodeStats.set(nodeId, {
          time: msgTime,
          // Prefer exact counts if available, fall back to bucket parsing
          totalTasks: msg.data.totalTasks,
          activeTasks: msg.data.activeTasks,
          totalInvoices: msg.data.totalInvoices,
          totalTasksBucket: msg.data.totalTasksBucket,
          activeTasksBucket: msg.data.activeTasksBucket,
          continentBucket: msg.data.continentBucket,
          locationBucket: msg.data.locationBucket
        });
      }
    }
  });

  // Aggregate stats from all nodes
  let totalTasksSum = 0;
  let activeTasksSum = 0;
  let totalInvoicesSum = 0;

  nodeStats.forEach((stats) => {
    // Use exact counts if available, otherwise parse bucket minimum
    totalTasksSum += (typeof stats.totalTasks === 'number')
      ? stats.totalTasks
      : parseBucketMin(stats.totalTasksBucket);
    activeTasksSum += (typeof stats.activeTasks === 'number')
      ? stats.activeTasks
      : parseBucketMin(stats.activeTasksBucket);
    totalInvoicesSum += (typeof stats.totalInvoices === 'number')
      ? stats.totalInvoices
      : 0;

    if (stats.continentBucket && typeof stats.continentBucket === 'string') {
      const key = stats.continentBucket.toUpperCase();
      continentCounts[key] = (continentCounts[key] || 0) + 1;
    }
    if (stats.locationBucket && typeof stats.locationBucket === 'string') {
      locationCounts[stats.locationBucket] = (locationCounts[stats.locationBucket] || 0) + 1;
    }
  });

  // Count completed tasks from task_completed messages
  const completedTaskIds = new Set();
  messages.value.forEach(msg => {
    if (msg.message_type === 'task_completed' && msg.data?.taskIdHash) {
      completedTaskIds.add(msg.data.taskIdHash);
    }
  });

  const completedTasks = completedTaskIds.size || totalTasksSum; // Use total as fallback
  const successRate = totalTasksSum > 0 ? (completedTasks / totalTasksSum * 100) : 0;

  return {
    activeNodes: activeNodeIds.size || aggStats.activeNodes || activePeerCount.value,
    totalNodes: peers.value.length || aggStats.totalNodes || 0,
    totalTasks: totalTasksSum || aggStats.totalTasks || 0,
    completedTasks: completedTasks || aggStats.completedTasks || 0,
    failedTasks: aggStats.failedTasks || 0,
    cachedTasks: aggStats.cachedTasks || 0,
    tasksLast24h: aggStats.tasksLast24h || 0,
    totalInvoices: totalInvoicesSum || aggStats.totalInvoices || 0,
    invoicesLast24h: aggStats.invoicesLast24h || 0,
    successRate: successRate || aggStats.successRate || 0,
    cacheHitRate: aggStats.cacheHitRate || 0,
    executionTimeDistribution: aggStats.executionTimeDistribution || {},
    gasUsageDistribution: aggStats.gasUsageDistribution || {},
    stepsComputedDistribution: aggStats.stepsComputedDistribution || {},
    memoryUsedDistribution: aggStats.memoryUsedDistribution || {},
    chainDistribution: aggStats.chainDistribution || {},
    taskTypeDistribution: aggStats.taskTypeDistribution || {},
    continentDistribution: aggStats.continentDistribution || continentCounts,
    locationDistribution: aggStats.locationDistribution || locationCounts,
    lastUpdated: aggStats.lastUpdated,
    status: activeNodeIds.size > 0 ? 'computed' : aggStats.status
  };
});

// Always show globe - it's a key visual element
const showGlobalPresence = computed(() => true);

// Mock data for local development testing (5 nodes around the world)
const mockLocationData = {
  '40.7,-74.0': 2,   // New York, USA
  '51.5,-0.1': 3,    // London, UK
  '35.7,139.7': 1,   // Tokyo, Japan
  '-33.9,151.2': 2,  // Sydney, Australia
  '-23.5,-46.6': 1   // São Paulo, Brazil
};

const globeDistribution = computed(() => {
  const location = networkStatsData.value.locationDistribution || {};
  if (Object.keys(location).length > 0) {
    return location;
  }
  const continents = networkStatsData.value.continentDistribution || {};
  if (Object.keys(continents).length > 0) {
    return continents;
  }
  // Use mock data for local testing when no real data available
  if (import.meta.env.DEV) {
    return mockLocationData;
  }
  // No data yet - return empty, globe will show earth without points
  return {};
});

// Get latest stats for a specific node from messages
const selectedNodeStats = computed(() => {
  if (!selectedNode.value) return null;

  // Find the most recent heartbeat from this node
  const nodeMessages = messages.value
    .filter(m => m.sender_node_id === selectedNode.value.node_id && m.message_type === 'heartbeat')
    .sort((a, b) => new Date(b.received_at) - new Date(a.received_at));

  return nodeMessages[0]?.data || null;
});

const errorMessage = ref('');

const toTopList = (dist, limit = 5) => {
  const entries = Object.entries(dist || {})
    .map(([label, value]) => ({ label, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
  const max = entries[0]?.value || 0;
  return entries.map(entry => ({
    ...entry,
    percent: max > 0 ? Math.round((entry.value / max) * 100) : 0
  }));
};

const topChains = computed(() => toTopList(networkStatsData.value.chainDistribution));
const topTaskTypes = computed(() => toTopList(networkStatsData.value.taskTypeDistribution));
const topExecutionTimes = computed(() => toTopList(networkStatsData.value.executionTimeDistribution));
const topGasUsage = computed(() => toTopList(networkStatsData.value.gasUsageDistribution));
const topStepsComputed = computed(() => toTopList(networkStatsData.value.stepsComputedDistribution));
const topMemoryUsed = computed(() => toTopList(networkStatsData.value.memoryUsedDistribution));
const topContinents = computed(() => toTopList(networkStatsData.value.continentDistribution));

// Public federation server URL
const serverUrl = 'wss://f.tru.watch';

const isConnected = computed(() => status.value?.connected || false);

const statusClass = computed(() => {
  if (status.value?.status === 'not_initialized') return 'disconnected';
  if (isConnected.value) return 'connected';
  return 'connecting';
});

const statusLabel = computed(() => {
  if (status.value?.status === 'not_initialized') return 'Not Connected';
  if (isConnected.value) return 'Connected to Network';
  return 'Connecting...';
});

// Filter out heartbeats - only show join/leave/task events
const recentMessages = computed(() => {
  const importantTypes = ['node_joined', 'node_left', 'task_received', 'task_completed', 'invoice_created'];
  return (messages.value || [])
    .filter(msg => importantTypes.includes(msg.message_type))
    .slice(0, 15);
});

let refreshInterval = null;

onMounted(async () => {
  // Initialize federation store
  await federationStore.initialize();

  // Auto-connect if enabled but not connected
  if (settings.value?.enabled && !status.value?.connected) {
    try {
      await federationStore.enableFederation();
      await federationStore.fetchStatus();
    } catch (error) {
      console.error('Federation connect error:', error);
      errorMessage.value = 'Failed to connect to network';
    }
  }

  // Fetch on-chain stats
  fetchOnChainStats();

  // Refresh data periodically (only if enabled)
  refreshInterval = setInterval(() => {
    if (settings.value?.enabled) {
      federationStore.fetchStatus();
      federationStore.fetchMessages();
      federationStore.fetchPeers();
      federationStore.fetchAggregatedNetworkStats();
    }
  }, 5000);

  // Initial registration check will be set up after activePeers is defined
});

// Fetch on-chain data from node registry and staking contracts
async function fetchOnChainStats() {
  try {
    const [nodeCount, stakingStats] = await Promise.all([
      nodeRegistry.getNodeCount(),
      staking.getStats()
    ]);
    registeredNodeCount.value = nodeCount;
    if (stakingStats) {
      totalStakedTRU.value = stakingStats.totalStaked;
    }
  } catch (e) {
    console.error('Failed to fetch on-chain stats:', e);
  }
}

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

// Check if node is online (seen within last 2 minutes)
function isNodeOnline(peer) {
  if (!peer?.last_seen) return false;
  const lastSeen = new Date(peer.last_seen);
  const now = new Date();
  const diffMs = now - lastSeen;
  return diffMs < 120000; // 2 minutes
}

// Check if a peer is "my node"
function isMyNode(peer) {
  return settings.value?.nodeId && peer.node_id === settings.value.nodeId;
}

// Computed property for only active (online) peers, with my node first
const activePeers = computed(() => {
  const online = peers.value.filter(peer => isNodeOnline(peer));
  // Sort: my node first, then by last_seen
  return online.sort((a, b) => {
    if (isMyNode(a) && !isMyNode(b)) return -1;
    if (!isMyNode(a) && isMyNode(b)) return 1;
    return new Date(b.last_seen) - new Date(a.last_seen);
  });
});

// Check registration status for all active peers that look like Ethereum addresses
async function checkPeerRegistrations() {
  const ethAddressPattern = /^0x[a-fA-F0-9]{40}$/;
  const addressPeers = activePeers.value.filter(p => ethAddressPattern.test(p.node_id));
  if (addressPeers.length === 0) return;

  const addresses = addressPeers.map(p => p.node_id);
  const results = await nodeRegistry.checkMultipleRegistrations(addresses);
  registrationStatus.value = results;
}

// Watch for changes in active peers and check their registration status
watch(activePeers, () => {
  checkPeerRegistrations();
}, { deep: true });

// Initial registration check after component is ready
setTimeout(() => checkPeerRegistrations(), 2000);

// Format node ID for display
function formatNodeId(nodeId) {
  if (!nodeId) return 'Unknown';
  // Handle both "node-uuid" and plain UUID formats
  if (nodeId.startsWith('node-')) {
    return nodeId.slice(0, 17) + '...';
  }
  return nodeId.slice(0, 12) + '...';
}

// Open node details modal
function openNodeModal(peer) {
  selectedNode.value = peer;
}

// Open message details modal
function openMessageModal(msg) {
  selectedMessage.value = msg;
}

// Format key for display
function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/_/g, ' ');
}

// Format value for display
function formatValue(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Format full date time
function formatDateTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  return date.toLocaleString();
}

function getMessageIcon(type) {
  const icons = {
    'task_received': '📥',
    'task_completed': '✅',
    'heartbeat': '💓',
    'node_joined': '🟢',
    'node_left': '🔴',
    'invoice_created': '💰',
    'node_stats': '📊',
    'task_stats': '📈'
  };
  return icons[type] || '📨';
}

function getMessageTitle(type) {
  const titles = {
    'task_received': 'Task Received',
    'task_completed': 'Task Completed',
    'heartbeat': 'Node Heartbeat',
    'node_joined': 'Node Joined Network',
    'node_left': 'Node Left Network',
    'invoice_created': 'Invoice Created',
    'node_stats': 'Node Statistics',
    'task_stats': 'Task Statistics'
  };
  return titles[type] || 'Network Event';
}

function getMessageTypeClass(type) {
  const classes = {
    'task_received': 'type-received',
    'task_completed': 'type-completed',
    'heartbeat': 'type-heartbeat',
    'node_joined': 'type-joined',
    'node_left': 'type-left',
    'invoice_created': 'type-invoice',
    'node_stats': 'type-stats',
    'task_stats': 'type-stats'
  };
  return classes[type] || '';
}

function formatTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return date.toLocaleDateString();
}

// Continent code to friendly name mapping
const continentNames = {
  'AF': 'Africa',
  'AN': 'Antarctica',
  'AS': 'Asia',
  'EU': 'Europe',
  'NA': 'North America',
  'OC': 'Oceania',
  'SA': 'South America'
};

function formatContinent(code) {
  if (!code || typeof code !== 'string') return 'Unknown';
  const normalized = code.toUpperCase().trim();
  return continentNames[normalized] || normalized;
}

function formatLocationBucket(location) {
  if (!location || typeof location !== 'string') return 'Unknown';

  // Validate format: should be "lat,lon"
  const parts = location.split(',');
  if (parts.length !== 2) return 'Unknown';

  const lat = parseFloat(parts[0]);
  const lon = parseFloat(parts[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'Unknown';
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return 'Unknown';

  // Format with N/S and E/W indicators
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';

  return `${Math.abs(lat).toFixed(1)}°${latDir}, ${Math.abs(lon).toFixed(1)}°${lonDir}`;
}

// Format large numbers with K/M suffixes
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}
</script>

<style scoped>
.federation-view {
  padding: 1rem 2rem 2rem 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.wip-banner {
  background: var(--info-bg);
  border: 1px solid var(--info-border);
  color: var(--info-text);
  padding: 0.375rem 1rem;
  border-radius: 0.375rem;
  margin-bottom: 1rem;
  text-align: center;
  font-size: 0.75rem;
}

.unofficial-notice {
  background: var(--warn-bg);
  border: 1px solid var(--warn-border);
  color: var(--warn-text);
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  margin-top: 2rem;
  text-align: center;
  font-size: 0.875rem;
}

.unofficial-notice .notice-link {
  margin-left: 0.5rem;
  color: var(--warn-text);
  font-weight: 600;
  text-decoration: underline;
}

.unofficial-notice .notice-link:hover {
  color: var(--warn-text);
}

.status-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--surface);
  border-radius: 0.75rem;
  box-shadow: var(--shadow);
  margin-bottom: 1.5rem;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.connected {
  background: var(--success);
  box-shadow: 0 0 8px var(--success);
}

.status-indicator.connecting {
  background: #f59e0b;
  animation: pulse 1s infinite;
}

.status-indicator.disconnected {
  background: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.status-label {
  font-weight: 600;
  font-size: 1.1rem;
}

.error-banner {
  padding: 1rem;
  background: var(--danger-bg);
  color: var(--danger-text);
  border: 1px solid var(--danger-border);
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1rem;
}

.stats-grid.secondary {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 2rem;
}

.stats-grid.onchain {
  grid-template-columns: repeat(4, 1fr);
  margin-bottom: 1.5rem;
}

.onchain-stat {
  border: 1px solid var(--accent);
  position: relative;
}

.dark .onchain-stat {
  border-color: var(--accent);
  box-shadow: 0 0 10px var(--accent-glow);
}

.onchain-stat .stat-network {
  font-size: 0.65rem;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.25rem;
}

.onchain-stat.clickable {
  cursor: pointer;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, transform 0.15s;
}

.onchain-stat.clickable:hover {
  background: var(--surface-muted);
  transform: translateY(-2px);
}

.dark .onchain-stat.clickable:hover {
  box-shadow: 0 0 15px var(--accent-glow);
}

.onchain-stat .stat-icon {
  font-size: 1.5rem;
  color: var(--accent);
  margin-bottom: 0.25rem;
}

.stat-card {
  padding: 1.5rem;
  background: var(--surface);
  border-radius: 0.75rem;
  box-shadow: var(--shadow);
  text-align: center;
}

.stat-card.small {
  padding: 1rem;
}

.stat-card.small .stat-value {
  font-size: 1.5rem;
}

.stat-card.small .stat-label {
  font-size: 0.75rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text);
}

.stat-label {
  font-size: 0.875rem;
  color: var(--muted);
  margin-top: 0.25rem;
}

.section {
  margin-bottom: 2rem;
}

.section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text);
}

.globe-section .globe-card {
  background: var(--surface);
  border-radius: 0.75rem;
  box-shadow: var(--shadow);
  padding: 1rem;
}

/* Hero Section: Globe + Stats Side by Side */
.hero-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
  align-items: center;
}

.hero-globe {
  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
  border-radius: 1rem;
  padding: 1rem;
  border: 1px solid var(--border);
}

:root:not(.dark) .hero-globe {
  background: var(--surface);
}

.hero-stats {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.hero-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--accent);
  margin: 0;
}

.dark .hero-title {
  text-shadow: 0 0 10px var(--accent-glow);
}

.hero-stat {
  padding: 1.25rem 1.5rem;
  background: var(--surface);
  border-radius: 0.75rem;
  border: 1px solid var(--border);
}

.dark .hero-stat {
  background: linear-gradient(135deg, #0a0f1a 0%, #0d1424 100%);
}

.hero-stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text);
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.dark .hero-stat-value {
  color: var(--accent);
  text-shadow: 0 0 15px var(--accent-glow);
}

.hero-stat-label {
  font-size: 0.875rem;
  color: var(--muted);
  margin-top: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero-legend {
  font-size: 0.75rem;
  color: var(--muted);
  text-align: center;
}

/* Responsive: Stack on smaller screens */
@media (max-width: 768px) {
  .hero-section {
    grid-template-columns: 1fr;
  }
}

.globe-legend {
  text-align: center;
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.5rem;
}

.activity-list {
  background: var(--surface);
  border-radius: 0.75rem;
  box-shadow: var(--shadow);
  overflow: hidden;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.activity-item:last-child {
  border-bottom: none;
}

.activity-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-muted);
  border-radius: 0.5rem;
}

.activity-icon.type-received {
  background: #dbeafe;
}

.activity-icon.type-completed {
  background: #d1fae5;
}

.activity-icon.type-heartbeat {
  background: #fce7f3;
}

.activity-content {
  flex: 1;
}

.activity-title {
  font-weight: 600;
  color: var(--text);
}

.activity-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--muted);
  margin-top: 0.25rem;
}

.activity-node {
  font-family: monospace;
}

.empty-state {
  padding: 2rem;
  background: var(--surface);
  border-radius: 0.75rem;
  box-shadow: var(--shadow);
  text-align: center;
  color: var(--muted);
}

.peers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.peer-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--surface);
  border-radius: 0.5rem;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}

.peer-card:hover {
  background: var(--surface-muted);
  box-shadow: var(--shadow);
}

.peer-status {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #9ca3af;
  flex-shrink: 0;
}

.peer-status.online {
  background: #10b981;
  box-shadow: 0 0 6px #10b981;
}

.peer-info {
  flex: 1;
}

.peer-id {
  font-family: monospace;
  font-weight: 600;
  color: var(--text);
}

.peer-meta {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.25rem;
}

.peer-arrow {
  font-size: 1.25rem;
  color: var(--muted);
}

.peer-card.my-node {
  background: var(--info-bg);
  border: 2px solid var(--info-border);
}

.peer-card.my-node:hover {
  background: var(--info-bg);
}

.my-node-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  background: var(--info-border);
  color: white;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
  font-family: sans-serif;
  vertical-align: middle;
}

/* Activity item improvements */
.activity-item {
  cursor: pointer;
  transition: background 0.15s;
}

.activity-item:hover {
  background: var(--surface-muted);
}

.activity-arrow {
  font-size: 1.25rem;
  color: var(--muted);
}

.activity-details {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.detail-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: var(--surface-muted);
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: var(--text);
}

.activity-icon.type-stats {
  background: #e0e7ff;
}

.activity-icon.type-joined {
  background: #d1fae5;
}

.activity-icon.type-left {
  background: #fee2e2;
}

.activity-icon.type-invoice {
  background: #fef3c7;
}

/* Modal styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.modal-content {
  background: var(--surface);
  border-radius: 0.75rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
  max-width: 500px;
  width: 100%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: var(--text);
}

.modal-body {
  padding: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 0.875rem;
  color: var(--muted);
  flex-shrink: 0;
}

.detail-value {
  font-size: 0.875rem;
  color: var(--text);
  text-align: right;
  word-break: break-all;
  margin-left: 1rem;
}

.detail-value.monospace {
  font-family: monospace;
  font-size: 0.8rem;
}

.detail-value.text-red {
  color: #dc2626;
}

.detail-section {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.detail-section h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 0.75rem 0;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--surface-muted);
  color: var(--muted);
}

.status-badge.online {
  background: #d1fae5;
  color: #047857;
}

.breakdown-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.breakdown-card {
  background: var(--surface);
  border-radius: 0.75rem;
  box-shadow: var(--shadow);
  padding: 1rem;
}

.breakdown-card h3 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 0.75rem;
}

.breakdown-row {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.row-label {
  color: var(--muted);
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-value {
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 600;
}

.row-bar {
  height: 8px;
  background: var(--surface-muted);
  border-radius: 999px;
  overflow: hidden;
}

.row-fill {
  height: 100%;
  background: var(--info-border);
}

.empty-mini {
  color: var(--muted);
  font-size: 0.75rem;
}

/* Registration badges */
.registered-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  background: #10b981;
  color: white;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 600;
  font-family: sans-serif;
  vertical-align: middle;
}

.unregistered-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  background: #ef4444;
  color: white;
  border-radius: 0.25rem;
  font-size: 0.65rem;
  font-weight: 600;
  font-family: sans-serif;
  vertical-align: middle;
}

/* Registration checker */
.registration-checker {
  background: var(--surface);
  border-radius: 0.75rem;
  box-shadow: var(--shadow);
  padding: 1.5rem;
}

.checker-input-group {
  display: flex;
  gap: 0.75rem;
}

.checker-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-family: monospace;
  background: var(--surface);
  color: var(--text);
}

.checker-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.checker-button {
  padding: 0.75rem 1.5rem;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.checker-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.checker-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.checker-result {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 0.5rem;
}

.checker-result.registered {
  background: #d1fae5;
  border: 1px solid #10b981;
}

.dark .checker-result.registered {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid #10b981;
}

.checker-result.unregistered {
  background: #fee2e2;
  border: 1px solid #ef4444;
}

.dark .checker-result.unregistered {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #ef4444;
}

.result-icon {
  font-size: 1.5rem;
  font-weight: bold;
}

.checker-result.registered .result-icon {
  color: #10b981;
}

.checker-result.unregistered .result-icon {
  color: #ef4444;
}

.result-content {
  flex: 1;
}

.result-status {
  font-weight: 600;
  font-size: 1rem;
}

.checker-result.registered .result-status {
  color: #047857;
}

.dark .checker-result.registered .result-status {
  color: #10b981;
}

.checker-result.unregistered .result-status {
  color: #dc2626;
}

.dark .checker-result.unregistered .result-status {
  color: #ef4444;
}

.result-address {
  font-family: monospace;
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.25rem;
}

.result-meta {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 0.25rem;
}

.checker-error {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fee2e2;
  border: 1px solid #ef4444;
  border-radius: 0.5rem;
  color: #dc2626;
  font-size: 0.875rem;
}

.dark .checker-error {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.checker-hint {
  margin-top: 1rem;
  font-size: 0.75rem;
  color: var(--muted);
  text-align: center;
}

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stats-grid.secondary {
    grid-template-columns: repeat(2, 1fr);
  }

  .status-card {
    flex-direction: column;
    text-align: center;
  }

  .status-info {
    align-items: center;
  }

  .activity-meta {
    flex-direction: column;
    gap: 0.25rem;
  }
}
</style>
