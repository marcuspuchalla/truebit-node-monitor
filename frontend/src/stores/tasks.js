import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../services/api';

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref([]);
  const currentTask = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const pagination = ref({
    limit: 50,
    offset: 0,
    hasMore: false
  });

  const stats = ref({
    total: 0,
    completed: 0,
    failed: 0,
    executing: 0,
    avg_elapsed_ms: 0,
    avg_gas_used: 0
  });

  // Computed
  const completedTasks = computed(() =>
    tasks.value.filter(t => t.status === 'completed')
  );

  const failedTasks = computed(() =>
    tasks.value.filter(t => t.status === 'failed')
  );

  const executingTasks = computed(() =>
    tasks.value.filter(t => t.status === 'executing')
  );

  const recentTasks = computed(() =>
    tasks.value.slice(0, 10)
  );

  // Actions
  async function fetchTasks(params = {}) {
    try {
      loading.value = true;
      error.value = null;

      const data = await api.getTasks({
        limit: params.limit || pagination.value.limit,
        offset: params.offset || pagination.value.offset,
        status: params.status
      });

      tasks.value = data.tasks;
      pagination.value = data.pagination;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to fetch tasks:', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchTask(executionId) {
    try {
      loading.value = true;
      error.value = null;

      const data = await api.getTask(executionId);
      currentTask.value = data;
      return data;
    } catch (err) {
      error.value = err.message;
      console.error('Failed to fetch task:', err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  async function fetchStats() {
    try {
      const data = await api.getTaskStats();
      stats.value = data;
    } catch (err) {
      console.error('Failed to fetch task stats:', err);
    }
  }

  function addTask(task) {
    // Add to beginning of list
    tasks.value.unshift(task);

    // Update stats
    stats.value.total++;
  }

  function updateTask(update) {
    const index = tasks.value.findIndex(t => t.execution_id === update.executionId);

    if (index !== -1) {
      // Update existing task
      const task = tasks.value[index];

      if (update.event === 'started') {
        task.status = 'executing';
        task.started_at = new Date().toISOString();
        stats.value.executing++;
      } else if (update.event === 'completed') {
        task.status = 'completed';
        task.completed_at = new Date().toISOString();
        stats.value.completed++;
        if (stats.value.executing > 0) stats.value.executing--;
      } else if (update.event === 'metrics' && update.metrics) {
        Object.assign(task, {
          elapsed_ms: update.metrics.elapsed,
          gas_limit: update.metrics.gas?.limit,
          gas_used: update.metrics.gas?.used,
          memory_limit: update.metrics.memory?.limit,
          memory_peak: update.metrics.memory?.peak,
          exit_code: update.metrics.exitCode,
          cached: update.metrics.cached
        });
      }

      tasks.value[index] = { ...task };
    }

    // Update current task if viewing
    if (currentTask.value?.execution_id === update.executionId) {
      currentTask.value = { ...currentTask.value, ...update };
    }
  }

  function clearTasks() {
    tasks.value = [];
    currentTask.value = null;
  }

  return {
    tasks,
    currentTask,
    loading,
    error,
    pagination,
    stats,
    completedTasks,
    failedTasks,
    executingTasks,
    recentTasks,
    fetchTasks,
    fetchTask,
    fetchStats,
    addTask,
    updateTask,
    clearTasks
  };
});
