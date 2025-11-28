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

    <!-- Network Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ activePeerCount }}</div>
        <div class="stat-label">Active Nodes</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ totalMessagesReceived }}</div>
        <div class="stat-label">Network Events</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ totalMessagesSent }}</div>
        <div class="stat-label">Events Shared</div>
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
        >
          <div class="activity-icon" :class="getMessageTypeClass(msg.type)">
            {{ getMessageIcon(msg.type) }}
          </div>
          <div class="activity-content">
            <div class="activity-title">{{ getMessageTitle(msg.type) }}</div>
            <div class="activity-meta">
              <span class="activity-node">Node {{ msg.nodeId?.slice(0, 8) }}...</span>
              <span class="activity-time">{{ formatTime(msg.timestamp) }}</span>
            </div>
          </div>
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
        <div v-for="peer in peers" :key="peer.node_id" class="peer-card">
          <div class="peer-id">{{ peer.node_id.slice(0, 12) }}...</div>
          <div class="peer-meta">
            <span class="peer-seen">Last seen: {{ formatTime(peer.last_seen) }}</span>
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
  activePeerCount
} = storeToRefs(federationStore);

const errorMessage = ref('');

// Public federation server URL (logged to console only)
const serverUrl = 'wss://f.tru.watch:9086';
console.log('Federation server:', serverUrl);

const isConnected = computed(() => status.value?.connected || false);

const statusClass = computed(() => {
  if (isConnected.value) return 'connected';
  return 'connecting';
});

const statusLabel = computed(() => {
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

  // Auto-enable if not already enabled
  if (!settings.value?.enabled) {
    try {
      await federationStore.enableFederation();
    } catch (error) {
      errorMessage.value = 'Failed to connect to network';
    }
  }

  // Refresh data periodically
  refreshInterval = setInterval(() => {
    federationStore.fetchStatus();
    federationStore.fetchMessages();
    federationStore.fetchPeers();
  }, 5000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

function getMessageIcon(type) {
  const icons = {
    'task_received': '📥',
    'task_completed': '✅',
    'heartbeat': '💓'
  };
  return icons[type] || '📨';
}

function getMessageTitle(type) {
  const titles = {
    'task_received': 'Task Received',
    'task_completed': 'Task Completed',
    'heartbeat': 'Node Heartbeat'
  };
  return titles[type] || 'Network Event';
}

function getMessageTypeClass(type) {
  const classes = {
    'task_received': 'type-received',
    'task_completed': 'type-completed',
    'heartbeat': 'type-heartbeat'
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
  margin-bottom: 2rem;
}

.stat-card {
  padding: 1.5rem;
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  text-align: center;
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
  padding: 1rem;
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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

@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: 1fr;
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
