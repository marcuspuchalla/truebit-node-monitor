<template>
  <div class="federation-view">
    <div class="header">
      <h1>Federation Network</h1>
      <p class="subtitle">Share anonymized task statistics with the global network</p>
    </div>

    <!-- Connection Status -->
    <div class="status-card" :class="statusClass">
      <div class="status-indicator" :class="statusClass"></div>
      <div class="status-info">
        <span class="status-label">{{ statusLabel }}</span>
        <span class="status-server">{{ serverUrl }}</span>
      </div>
      <button
        class="toggle-btn"
        :class="{ enabled: isEnabled }"
        @click="toggleFederation"
        :disabled="isLoading"
      >
        {{ isLoading ? 'Connecting...' : (isEnabled ? 'Disable' : 'Enable') }}
      </button>
    </div>

    <!-- Error Message -->
    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>

    <!-- Stats (only when connected) -->
    <div v-if="isConnected" class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ totalMessagesSent }}</div>
        <div class="stat-label">Messages Sent</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ totalMessagesReceived }}</div>
        <div class="stat-label">Messages Received</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ activePeerCount }}</div>
        <div class="stat-label">Active Peers</div>
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
  settingsLoading,
  totalMessagesSent,
  totalMessagesReceived,
  activePeerCount
} = storeToRefs(federationStore);

const errorMessage = ref('');
const isLoading = ref(false);

// Hardcoded server URL for Docker deployments
const serverUrl = 'ws://nats-seed:9086';

const isEnabled = computed(() => settings.value?.enabled || false);
const isConnected = computed(() => status.value?.connected || false);

const statusClass = computed(() => {
  if (isLoading.value) return 'connecting';
  if (isConnected.value) return 'connected';
  if (isEnabled.value) return 'disconnected';
  return 'disabled';
});

const statusLabel = computed(() => {
  if (isLoading.value) return 'Connecting...';
  if (isConnected.value) return 'Connected';
  if (isEnabled.value) return 'Disconnected';
  return 'Disabled';
});

let refreshInterval = null;

onMounted(async () => {
  await federationStore.initialize();

  // Refresh status every 5 seconds
  refreshInterval = setInterval(() => {
    if (isEnabled.value) {
      federationStore.fetchStatus();
    }
  }, 5000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

async function toggleFederation() {
  errorMessage.value = '';
  isLoading.value = true;

  console.log('Toggle federation clicked, isEnabled:', isEnabled.value);

  try {
    if (isEnabled.value) {
      console.log('Calling disableFederation...');
      await federationStore.disableFederation();
      console.log('disableFederation completed');
    } else {
      console.log('Calling enableFederation...');
      await federationStore.enableFederation();
      console.log('enableFederation completed');
    }
    // Refresh status after toggle
    console.log('Fetching status...');
    await federationStore.fetchStatus();
    console.log('Status fetched, isEnabled now:', isEnabled.value, 'isConnected:', isConnected.value);
  } catch (error) {
    console.error('Toggle federation error:', error);
    errorMessage.value = error.response?.data?.error || error.message || 'Connection failed';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.federation-view {
  padding: 2rem;
  max-width: 800px;
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

.status-indicator.disabled {
  background: #9ca3af;
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

.status-server {
  font-size: 0.875rem;
  color: #6b7280;
  font-family: monospace;
}

.toggle-btn {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: #3b82f6;
  color: white;
}

.toggle-btn:hover:not(:disabled) {
  background: #2563eb;
}

.toggle-btn.enabled {
  background: #6b7280;
}

.toggle-btn.enabled:hover:not(:disabled) {
  background: #4b5563;
}

.toggle-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
}
</style>
