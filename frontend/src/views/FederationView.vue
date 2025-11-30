<template>
  <div class="federation-view">
    <div class="header">
      <h1>TrueBit Network</h1>
      <p class="subtitle">Global network status and statistics</p>
    </div>

    <!-- Connection Status -->
    <div class="status-card" :class="statusClass">
      <div class="status-indicator" :class="statusClass"></div>
      <div class="status-info">
        <span class="status-label">{{ statusLabel }}</span>
      </div>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>

    <!-- Network Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ networkStatsData.activeNodes || activePeerCount }}</div>
        <div class="stat-label">Active Nodes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ networkStatsData.totalTasks || 0 }}</div>
        <div class="stat-label">Total Tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ networkStatsData.totalInvoices || 0 }}</div>
        <div class="stat-label">Total Invoices</div>
      </div>
    </div>

    <!-- Extended Stats -->
    <div class="stats-grid secondary">
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.completedTasks || 0 }}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.tasksLast24h || 0 }}</div>
        <div class="stat-label">Last 24h</div>
      </div>
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.successRate?.toFixed(1) || 0 }}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
      <div class="stat-card small">
        <div class="stat-value">{{ networkStatsData.invoicesLast24h || 0 }}</div>
        <div class="stat-label">Invoices 24h</div>
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
    <div class="section" v-if="peers.length > 0">
      <h2>Active Nodes</h2>
      <div class="peers-grid">
        <div v-for="peer in peers" :key="peer.node_id" class="peer-card" @click="openNodeModal(peer)">
          <div class="peer-status" :class="{ online: isNodeOnline(peer) }"></div>
          <div class="peer-info">
            <div class="peer-id">{{ formatNodeId(peer.node_id) }}</div>
            <div class="peer-meta">
              <span class="peer-seen">Last seen: {{ formatTime(peer.last_seen) }}</span>
            </div>
          </div>
          <div class="peer-arrow">›</div>
        </div>
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
            <span class="detail-value">{{ selectedNodeStats.activeTasksBucket || '0' }}</span>
          </div>
          <div class="detail-row" v-if="selectedNodeStats">
            <span class="detail-label">Total Tasks</span>
            <span class="detail-value">{{ selectedNodeStats.totalTasksBucket || '0' }}</span>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useFederationStore } from '../stores/federation';

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

// Computed network stats with fallbacks - compute from messages if aggregator data not available
const networkStatsData = computed(() => {
  const aggStats = aggregatedNetworkStats.value || {};

  // If we have aggregator data, use it
  if (aggStats.status !== 'awaiting_data' && aggStats.activeNodes > 0) {
    return aggStats;
  }

  // Otherwise, compute from available data
  const uniqueNodes = new Set();
  let totalTasks = 0;
  let completedTasks = 0;

  // Count unique nodes from peers
  peers.value.forEach(peer => {
    uniqueNodes.add(peer.node_id);
  });

  // Get stats from heartbeat messages
  messages.value.forEach(msg => {
    if (msg.sender_node_id) {
      uniqueNodes.add(msg.sender_node_id);
    }
    if (msg.message_type === 'heartbeat' && msg.data) {
      const tasks = parseInt(msg.data.totalTasksBucket) || 0;
      if (tasks > totalTasks) totalTasks = tasks;
    }
    if (msg.message_type === 'task_completed') {
      completedTasks++;
    }
  });

  return {
    activeNodes: uniqueNodes.size || aggStats.activeNodes || activePeerCount.value,
    totalNodes: uniqueNodes.size || aggStats.totalNodes || 0,
    totalTasks: totalTasks || aggStats.totalTasks || 0,
    completedTasks: completedTasks || aggStats.completedTasks || 0,
    failedTasks: aggStats.failedTasks || 0,
    cachedTasks: aggStats.cachedTasks || 0,
    tasksLast24h: aggStats.tasksLast24h || 0,
    totalInvoices: aggStats.totalInvoices || 0,
    invoicesLast24h: aggStats.invoicesLast24h || 0,
    successRate: aggStats.successRate || 0,
    cacheHitRate: aggStats.cacheHitRate || 0,
    lastUpdated: aggStats.lastUpdated,
    status: uniqueNodes.size > 0 ? 'computed' : aggStats.status
  };
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

// Public federation server URL (logged to console only)
const serverUrl = 'wss://f.tru.watch:9086';
console.log('Federation server:', serverUrl);

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

const recentMessages = computed(() => {
  return (messages.value || []).slice(0, 10);
});

let refreshInterval = null;

onMounted(async () => {
  // Initialize and auto-enable federation
  await federationStore.initialize();

  // Auto-enable if not already enabled or not connected
  if (!settings.value?.enabled || !status.value?.connected) {
    try {
      await federationStore.enableFederation();
      // Refresh status after enabling
      await federationStore.fetchStatus();
    } catch (error) {
      console.error('Federation enable error:', error);
      errorMessage.value = 'Failed to connect to network';
    }
  }

  // Refresh data periodically
  refreshInterval = setInterval(() => {
    federationStore.fetchStatus();
    federationStore.fetchMessages();
    federationStore.fetchPeers();
    federationStore.fetchAggregatedNetworkStats();
  }, 5000);
});

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
</script>

<style scoped>
.federation-view {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
  text-align: center;
}

.header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #6b7280;
  font-size: 1.1rem;
}

.status-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 1.5rem;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-indicator.connected {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
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
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
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

.stat-card {
  padding: 1.5rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
  color: #1f2937;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.section {
  margin-bottom: 2rem;
}

.section h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #1f2937;
}

.activity-list {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
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
  background: #f3f4f6;
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
  color: #1f2937;
}

.activity-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.activity-node {
  font-family: monospace;
}

.empty-state {
  padding: 2rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  text-align: center;
  color: #6b7280;
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
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}

.peer-card:hover {
  background: #f9fafb;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
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
  color: #1f2937;
}

.peer-meta {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.peer-arrow {
  font-size: 1.25rem;
  color: #9ca3af;
}

/* Activity item improvements */
.activity-item {
  cursor: pointer;
  transition: background 0.15s;
}

.activity-item:hover {
  background: #f9fafb;
}

.activity-arrow {
  font-size: 1.25rem;
  color: #9ca3af;
}

.activity-details {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.detail-badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  background: #e5e7eb;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  color: #374151;
}

.activity-icon.type-stats {
  background: #e0e7ff;
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
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
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
  border-bottom: 1px solid #e5e7eb;
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
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: #1f2937;
}

.modal-body {
  padding: 1.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 0.875rem;
  color: #6b7280;
  flex-shrink: 0;
}

.detail-value {
  font-size: 0.875rem;
  color: #1f2937;
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
  border-top: 1px solid #e5e7eb;
}

.detail-section h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem 0;
}

.status-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: #f3f4f6;
  color: #6b7280;
}

.status-badge.online {
  background: #d1fae5;
  color: #047857;
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
