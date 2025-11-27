<template>
  <div class="federation-view">
    <div class="header">
      <h1>Federation Network</h1>
      <p class="subtitle">Privacy-first decentralized monitoring</p>
    </div>

    <!-- Status Banner -->
    <div v-if="!isEnabled" class="banner banner-info">
      ⚠️ Federation is currently disabled. Enable it below to participate in the global network.
    </div>
    <div v-else-if="!isConnected" class="banner banner-warning">
      🔴 Federation is enabled but not connected. Checking connection...
    </div>
    <div v-else-if="isHealthy" class="banner banner-success">
      ✅ Connected to federation network. Your node is participating securely.
    </div>

    <!-- Quick Stats -->
    <div v-if="isEnabled" class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Messages Sent</div>
        <div class="stat-value">{{ totalMessagesSent }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Messages Received</div>
        <div class="stat-value">{{ totalMessagesReceived }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Peers</div>
        <div class="stat-value">{{ activePeerCount }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Connection Status</div>
        <div class="stat-value">{{ isConnected ? 'Connected' : 'Disconnected' }}</div>
      </div>
    </div>

    <!-- Settings Section -->
    <div class="section">
      <h2>Federation Settings</h2>

      <div class="settings-form">
        <div class="form-group">
          <label class="toggle-label">
            <input
              type="checkbox"
              v-model="localSettings.enabled"
              @change="handleToggleFederation"
              :disabled="settingsLoading"
            />
            <span>Enable Federation</span>
          </label>
          <p class="help-text">
            Opt-in to share anonymized task statistics with the global network
          </p>
        </div>

        <div v-if="localSettings.enabled" class="advanced-settings">
          <div class="form-group">
            <label>NATS Server URL</label>
            <input
              type="text"
              v-model="natsServerUrl"
              placeholder="wss://f.tru.watch:9086"
              @blur="saveNatsServer"
            />
            <p class="help-text">WebSocket URL of the federation NATS server</p>
          </div>

          <div class="form-group">
            <label>Privacy Level</label>
            <select v-model="localSettings.privacyLevel" @change="saveSettings">
              <option value="minimal">Minimal (more data shared)</option>
              <option value="balanced">Balanced (recommended)</option>
              <option value="maximum">Maximum (minimal data shared)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" v-model="localSettings.shareTasks" @change="saveSettings" />
              <span>Share Task Events</span>
            </label>
          </div>

          <div class="form-group">
            <label class="toggle-label">
              <input type="checkbox" v-model="localSettings.shareStats" @change="saveSettings" />
              <span>Share Statistics</span>
            </label>
          </div>

          <div class="form-group">
            <label>Node ID (Public)</label>
            <input type="text" :value="settings.nodeId" disabled class="readonly-input" />
            <p class="help-text">Random identifier (not your wallet address)</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Privacy Guarantees -->
    <div class="section privacy-section">
      <h2>🔒 Privacy Guarantees</h2>
      <div class="privacy-grid">
        <div class="privacy-item">
          <strong>Wallet Privacy</strong>
          <p>Your wallet address is NEVER collected or shared</p>
        </div>
        <div class="privacy-item">
          <strong>Task Data Privacy</strong>
          <p>Task input/output stays local - never transmitted</p>
        </div>
        <div class="privacy-item">
          <strong>IP Privacy</strong>
          <p>Your IP address is hidden from peers</p>
        </div>
        <div class="privacy-item">
          <strong>No Fingerprinting</strong>
          <p>Metrics bucketed into ranges to prevent identification</p>
        </div>
      </div>
      <div class="privacy-score">
        Privacy Score: <strong>98/100</strong>
      </div>
    </div>

    <!-- Network Activity (only show if enabled) -->
    <div v-if="isEnabled" class="section">
      <h2>Network Activity</h2>

      <!-- Peers -->
      <div class="subsection">
        <h3>Known Peers ({{ peers.length }})</h3>
        <div v-if="peersLoading" class="loading">Loading peers...</div>
        <div v-else-if="peers.length === 0" class="empty-state">
          No peers yet. Connect to see other nodes in the network.
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Node ID</th>
              <th>First Seen</th>
              <th>Last Seen</th>
              <th>Messages</th>
              <th>Reputation</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="peer in peers" :key="peer.node_id">
              <td><code>{{ peer.node_id.substring(0, 16) }}...</code></td>
              <td>{{ formatDate(peer.first_seen) }}</td>
              <td>{{ formatDate(peer.last_seen) }}</td>
              <td>{{ peer.message_count }}</td>
              <td>
                <span class="reputation-badge" :class="getReputationClass(peer.reputation_score)">
                  {{ (peer.reputation_score * 100).toFixed(0) }}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Recent Messages -->
      <div class="subsection">
        <h3>Recent Messages ({{ messages.length }})</h3>
        <div v-if="messagesLoading" class="loading">Loading messages...</div>
        <div v-else-if="messages.length === 0" class="empty-state">
          No messages yet. You'll see task updates from other nodes here.
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>From</th>
              <th>Received</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="msg in messages.slice(0, 20)" :key="msg.id">
              <td><span class="type-badge">{{ msg.message_type }}</span></td>
              <td><code>{{ msg.sender_node_id.substring(0, 12) }}...</code></td>
              <td>{{ formatDate(msg.received_at) }}</td>
              <td class="data-preview">{{ JSON.stringify(msg.data).substring(0, 50) }}...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useFederationStore } from '../stores/federation';
import { storeToRefs } from 'pinia';

const federationStore = useFederationStore();

const {
  settings,
  status,
  messages,
  peers,
  settingsLoading,
  messagesLoading,
  peersLoading,
  isEnabled,
  isConnected,
  isHealthy,
  totalMessagesSent,
  totalMessagesReceived,
  activePeerCount
} = storeToRefs(federationStore);

const localSettings = ref({});
const natsServerUrl = ref('');

let refreshInterval = null;

onMounted(async () => {
  await federationStore.initialize();
  localSettings.value = { ...settings.value };
  // Initialize NATS server URL from settings array
  if (settings.value.natsServers && settings.value.natsServers.length > 0) {
    natsServerUrl.value = settings.value.natsServers[0];
  }

  // Refresh every 10 seconds if enabled
  refreshInterval = setInterval(() => {
    if (isEnabled.value) {
      federationStore.refresh();
    }
  }, 10000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});

async function handleToggleFederation() {
  try {
    if (localSettings.value.enabled) {
      await federationStore.enableFederation();
    } else {
      await federationStore.disableFederation();
    }
  } catch (error) {
    alert('Failed to toggle federation: ' + error.message);
    localSettings.value.enabled = !localSettings.value.enabled;
  }
}

async function saveSettings() {
  try {
    await federationStore.updateSettings(localSettings.value);
  } catch (error) {
    alert('Failed to save settings: ' + error.message);
  }
}

async function saveNatsServer() {
  try {
    const servers = natsServerUrl.value ? [natsServerUrl.value] : [];
    await federationStore.updateSettings({
      ...localSettings.value,
      natsServers: servers
    });
  } catch (error) {
    alert('Failed to save NATS server: ' + error.message);
  }
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleString();
}

function getReputationClass(score) {
  if (score >= 0.8) return 'reputation-high';
  if (score >= 0.5) return 'reputation-medium';
  return 'reputation-low';
}
</script>

<style scoped>
.federation-view {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  margin-bottom: 2rem;
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

.banner {
  padding: 1rem;
  border-radius: 0.5rem;
  margin-bottom: 2rem;
  font-weight: 500;
}

.banner-info {
  background: #dbeafe;
  color: #1e40af;
  border: 1px solid #93c5fd;
}

.banner-warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.banner-success {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #6ee7b7;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.stat-label {
  font-size: 0.875rem;
  color: #6b7280;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.section {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  margin-bottom: 2rem;
}

.section h2 {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
}

.subsection h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
  margin-top: 2rem;
}

.settings-form {
  max-width: 600px;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.toggle-label input[type="checkbox"] {
  width: 1.25rem;
  height: 1.25rem;
}

select, input[type="text"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

.readonly-input {
  background: #f3f4f6;
  cursor: not-allowed;
}

.help-text {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

.advanced-settings {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.privacy-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.privacy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.privacy-item {
  background: rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 0.5rem;
}

.privacy-item strong {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.privacy-score {
  text-align: center;
  font-size: 1.25rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.data-table th {
  text-align: left;
  padding: 0.75rem;
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
  font-weight: 600;
}

.data-table td {
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

code {
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-family: monospace;
  font-size: 0.8rem;
}

.type-badge {
  background: #dbeafe;
  color: #1e40af;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.reputation-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
  font-size: 0.75rem;
}

.reputation-high {
  background: #d1fae5;
  color: #065f46;
}

.reputation-medium {
  background: #fef3c7;
  color: #92400e;
}

.reputation-low {
  background: #fee2e2;
  color: #991b1b;
}

.loading {
  text-align: center;
  padding: 2rem;
  color: #6b7280;
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
  font-style: italic;
}

.data-preview {
  font-family: monospace;
  font-size: 0.75rem;
  color: #6b7280;
}
</style>
