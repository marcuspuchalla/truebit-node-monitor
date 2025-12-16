import { defineStore } from 'pinia';
import { ref } from 'vue';
import api, { type Log, type LogsParams } from '../services/api';

interface LogFilter {
  level: string | null;
  type: string | null;
  search: string;
}

export const useLogsStore = defineStore('logs', () => {
  const logs = ref<Log[]>([]);
  const maxLogs = ref(500); // Keep last 500 logs in memory
  const loading = ref(false);
  const filter = ref<LogFilter>({
    level: null,
    type: null,
    search: ''
  });

  async function fetchLogs(params: LogsParams = {}): Promise<void> {
    try {
      loading.value = true;
      const data = await api.getLogs({
        limit: params.limit || 100,
        offset: params.offset || 0,
        level: params.level || null,
        type: params.type || null,
        search: params.search || null
      });

      // Replace logs with fetched data (most recent first)
      if (data.logs && Array.isArray(data.logs)) {
        logs.value = data.logs.reverse(); // Reverse to show newest first
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      loading.value = false;
    }
  }

  function addLog(log: Log): void {
    logs.value.unshift(log);

    // Trim if exceeds max
    if (logs.value.length > maxLogs.value) {
      logs.value = logs.value.slice(0, maxLogs.value);
    }
  }

  function clearLogs(): void {
    logs.value = [];
  }

  function setFilter(newFilter: Partial<LogFilter>): void {
    filter.value = { ...filter.value, ...newFilter };
  }

  const filteredLogs = ref<Log[]>([]);

  function applyFilters(): void {
    let result = [...logs.value];

    if (filter.value.level) {
      result = result.filter(log => log.level === filter.value.level);
    }

    if (filter.value.type) {
      result = result.filter(log => log.type === filter.value.type);
    }

    if (filter.value.search) {
      const search = filter.value.search.toLowerCase();
      result = result.filter(log =>
        log.message?.toLowerCase().includes(search) ||
        log.raw?.toLowerCase().includes(search)
      );
    }

    filteredLogs.value = result;
  }

  return {
    logs,
    maxLogs,
    loading,
    filter,
    filteredLogs,
    fetchLogs,
    addLog,
    clearLogs,
    setFilter,
    applyFilters
  };
});
