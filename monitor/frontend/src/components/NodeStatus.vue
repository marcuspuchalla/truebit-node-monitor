<template>
  <div class="card">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Node Status</h2>

    <!-- Online/Offline Status -->
    <div class="flex items-center gap-3 mb-4">
      <div
        class="status-dot"
        :class="nodeStore.isOnline ? 'online' : 'offline'"
      ></div>
      <span class="text-xl font-bold" :class="nodeStore.isOnline ? 'text-green-600' : 'text-red-600'">
        {{ nodeStore.isOnline ? 'Online' : 'Offline' }}
      </span>
    </div>

    <!-- Status Details -->
    <div class="space-y-3 text-sm">
      <div class="flex justify-between">
        <span class="text-gray-500">Container:</span>
        <span class="font-medium">{{ containerName }}</span>
      </div>

      <div class="flex justify-between">
        <span class="text-gray-500">Version:</span>
        <span class="font-mono text-xs">{{ version }}</span>
      </div>

      <div class="flex justify-between">
        <span class="text-gray-500">Last Checked:</span>
        <span class="font-medium">{{ lastChecked }}</span>
      </div>

      <div class="flex justify-between">
        <span class="text-gray-500">Last Log:</span>
        <span class="font-medium">{{ lastLogTime }}</span>
      </div>

      <div class="flex justify-between">
        <span class="text-gray-500">Uptime:</span>
        <span class="font-medium">{{ nodeStore.uptimeFormatted }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useNodeStore } from '../stores/node';
import api from '../services/api';

const nodeStore = useNodeStore();
const lastLog = ref(null);
const lastCheckTime = ref(new Date());

const containerName = computed(() => nodeStore.containerInfo?.name || 'N/A');

const version = computed(() => {
  const image = nodeStore.containerInfo?.image || '';
  // Extract version from image name like "truebitprotocol/runner-node:prod"
  const parts = image.split(':');
  return parts.length > 1 ? parts[1] : image || 'N/A';
});

const lastChecked = computed(() => {
  return formatTimeAgo(lastCheckTime.value);
});

const lastLogTime = computed(() => {
  if (!lastLog.value?.timestamp) return 'N/A';
  return formatTimeAgo(new Date(lastLog.value.timestamp));
});

function formatTimeAgo(date) {
  const seconds = Math.floor((Date.now() - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

async function fetchLastLog() {
  try {
    const response = await api.getLogs({ limit: 1 });
    if (response.logs?.length > 0) {
      lastLog.value = response.logs[0];
    }
  } catch (err) {
    console.error('Failed to fetch last log:', err);
  }
}

async function refresh() {
  await nodeStore.fetchStatus();
  await fetchLastLog();
  lastCheckTime.value = new Date();
}

let refreshInterval = null;

onMounted(async () => {
  await refresh();
  // Refresh every 30 seconds
  refreshInterval = setInterval(refresh, 30000);
});

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
});
</script>

<style scoped>
.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-dot.online {
  background-color: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.status-dot.offline {
  background-color: #ef4444;
  box-shadow: 0 0 8px #ef4444;
}
</style>
