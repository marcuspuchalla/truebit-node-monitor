<template>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100">Real-time Logs</h2>
      <p class="text-xs text-gray-500 dark:text-slate-400">
          Source: {{ logsStore.status.source || 'unknown' }}
          <span v-if="logsStore.status.lastLogAt">· Last: {{ formatTimestamp(logsStore.status.lastLogAt) }}</span>
        </p>
      </div>
      <div class="flex items-center space-x-2">
        <select
          v-model="selectedLevel"
          class="text-sm border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 rounded-md"
          @change="filterLogs"
        >
          <option value="">All Levels</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <button
          @click="logsStore.clearLogs()"
          class="text-sm px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Clear
        </button>
      </div>
    </div>

    <div
      ref="logContainer"
      class="bg-gray-900 text-gray-100 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs"
    >
      <div v-if="displayLogs.length === 0" class="text-gray-400 text-center py-8">
        Waiting for logs...
      </div>
      <div
        v-for="(log, index) in displayLogs"
        :key="index"
        class="py-1 border-b border-gray-800 last:border-0"
      >
        <span :class="getLevelColor(log.level)" class="font-semibold">
          [{{ log.level?.toUpperCase() || 'INFO' }}]
        </span>
        <span class="text-gray-400 ml-2">
          {{ formatTimestamp(log.timestamp) }}
        </span>
        <span class="ml-2">
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

function getLevelColor(level) {
  const colors = {
    info: 'text-blue-400',
    warn: 'text-yellow-400',
    error: 'text-red-400'
  };
  return colors[level] || 'text-gray-400';
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
