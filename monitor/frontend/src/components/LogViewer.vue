<template>
  <div class="log-viewer-card">
    <div class="log-header">
      <div>
        <h2 class="log-title">Real-time Logs</h2>
        <p class="log-subtitle">
          Source: {{ logsStore.status.source || 'unknown' }}
          <span v-if="logsStore.status.lastLogAt">· Last: {{ formatTimestamp(logsStore.status.lastLogAt) }}</span>
        </p>
      </div>
      <div class="log-controls">
        <select
          v-model="selectedLevel"
          class="log-select"
          @change="filterLogs"
        >
          <option value="">All Levels</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <button
          @click="logsStore.clearLogs()"
          class="log-btn"
        >
          Clear
        </button>
      </div>
    </div>

    <div
      ref="logContainer"
      class="log-terminal"
    >
      <div v-if="displayLogs.length === 0" class="log-empty">
        <span class="terminal-cursor"></span> Waiting for logs...
      </div>
      <div
        v-for="(log, index) in displayLogs"
        :key="index"
        class="log-entry"
      >
        <span :class="getLevelClass(log.level)" class="log-level">
          [{{ log.level?.toUpperCase() || 'INFO' }}]
        </span>
        <span class="log-time">
          {{ formatTimestamp(log.timestamp) }}
        </span>
        <span class="log-message">
          {{ log.message || log.raw }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useLogsStore } from '../stores/logs';

const props = defineProps({
  maxLogs: {
    type: Number,
    default: 100
  },
  autoScroll: {
    type: Boolean,
    default: true
  }
});

const logsStore = useLogsStore();
const logContainer = ref(null);
const selectedLevel = ref('');

const displayLogs = computed(() => {
  let logs = selectedLevel.value
    ? logsStore.logs.filter(log => log.level === selectedLevel.value)
    : logsStore.logs;

  return logs.slice(0, props.maxLogs);
});

function getLevelClass(level) {
  const classes = {
    info: 'level-info',
    warn: 'level-warn',
    error: 'level-error'
  };
  return classes[level] || 'level-default';
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function filterLogs() {
  logsStore.setFilter({ level: selectedLevel.value });
}

watch(() => logsStore.logs.length, async () => {
  if (props.autoScroll && logContainer.value) {
    await nextTick();
    logContainer.value.scrollTop = logContainer.value.scrollHeight;
  }
});

let statusTimer;

onMounted(() => {
  // Fetch initial logs from API
  logsStore.fetchLogs({ limit: props.maxLogs });
  logsStore.fetchStatus();
  statusTimer = setInterval(() => logsStore.fetchStatus(), 10000);
});

onUnmounted(() => {
  if (statusTimer) {
    clearInterval(statusTimer);
  }
});
</script>

<style scoped>
.log-viewer-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.dark .log-viewer-card {
  background: linear-gradient(135deg, #0a0f1a 0%, #0d1424 100%);
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.log-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text);
}

.dark .log-title {
  color: var(--accent);
  text-shadow: 0 0 10px var(--accent-glow);
}

.log-subtitle {
  font-size: 0.75rem;
  color: var(--muted);
}

.log-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.log-select {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--surface);
  color: var(--text);
}

.dark .log-select {
  background: #0a0f1a;
}

.dark .log-select:focus {
  border-color: var(--accent);
  outline: none;
  box-shadow: 0 0 5px var(--accent-glow);
}

.log-btn {
  font-size: 0.875rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: var(--surface-muted);
  color: var(--text);
  cursor: pointer;
  transition: all 0.2s;
}

.dark .log-btn:hover {
  border-color: var(--accent);
  box-shadow: 0 0 5px var(--accent-glow);
}

.log-terminal {
  background: #050810;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 1rem;
  height: 24rem;
  overflow-y: auto;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.75rem;
  line-height: 1.5;
}

.dark .log-terminal {
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
}

.log-empty {
  color: var(--muted);
  text-align: center;
  padding: 2rem;
}

.terminal-cursor {
  display: inline-block;
  width: 8px;
  height: 14px;
  background: var(--accent);
  animation: blink 1s step-end infinite;
  vertical-align: middle;
  margin-right: 0.5rem;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.log-entry {
  padding: 0.25rem 0;
  border-bottom: 1px solid rgba(26, 58, 92, 0.3);
}

.log-entry:last-child {
  border-bottom: none;
}

.log-level {
  font-weight: 600;
}

.level-info {
  color: #00d4ff;
  text-shadow: 0 0 5px rgba(0, 212, 255, 0.5);
}

.level-warn {
  color: #ffaa00;
  text-shadow: 0 0 5px rgba(255, 170, 0, 0.5);
}

.level-error {
  color: #ff3366;
  text-shadow: 0 0 5px rgba(255, 51, 102, 0.5);
}

.level-default {
  color: var(--muted);
}

.log-time {
  color: var(--muted);
  margin-left: 0.5rem;
}

.log-message {
  color: var(--text);
  margin-left: 0.5rem;
}

/* Scrollbar styling */
.log-terminal::-webkit-scrollbar {
  width: 8px;
}

.log-terminal::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.log-terminal::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

.dark .log-terminal::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}
</style>
