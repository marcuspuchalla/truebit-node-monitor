import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api, { type NodeStatus, type ContainerInfo, type ContainerStats } from '../services/api';

interface WebSocketStatusData {
  address?: string;
  [key: string]: unknown;
}

interface WebSocketSlotsData {
  current: number;
  total: number;
}

export const useNodeStore = defineStore('node', () => {
  const status = ref<NodeStatus | null>(null);
  const stats = ref<ContainerStats | null>(null);
  const containerInfo = ref<ContainerInfo | null>(null);
  const containerStats = ref<ContainerStats | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const connected = ref(false);

  // Computed
  const isOnline = computed(() => containerInfo.value?.running || false);
  const uptimeSeconds = computed(() => {
    if (!containerInfo.value?.startedAt) return 0;
    const start = new Date(containerInfo.value.startedAt);
    return Math.floor((Date.now() - start.getTime()) / 1000);
  });

  const uptimeFormatted = computed(() => {
    const seconds = uptimeSeconds.value;
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  });

  // Actions
  async function fetchStatus(): Promise<void> {
    try {
      loading.value = true;
      error.value = null;

      const data = await api.getStatus();
      status.value = data.node;
      containerInfo.value = data.container;
      containerStats.value = data.stats;
    } catch (err) {
      error.value = (err as Error).message;
      console.error('Failed to fetch status:', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchStats(): Promise<void> {
    try {
      const data = await api.getStats();
      stats.value = data;
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }

  function updateFromWebSocket(data: WebSocketStatusData): void {
    if (data.address) {
      status.value = { ...status.value, ...data };
    }
  }

  function updateSlots(data: WebSocketSlotsData): void {
    if (status.value) {
      status.value.current_slots = data.current;
      status.value.total_slots = data.total;
    }
  }

  function setConnected(value: boolean): void {
    connected.value = value;
  }

  return {
    status,
    stats,
    containerInfo,
    containerStats,
    loading,
    error,
    connected,
    isOnline,
    uptimeSeconds,
    uptimeFormatted,
    fetchStatus,
    fetchStats,
    updateFromWebSocket,
    updateSlots,
    setConnected
  };
});
