<template>
  <div class="card">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4">Tasks Summary</h2>

    <!-- Total Count -->
    <div class="text-center mb-4">
      <div class="text-4xl font-bold text-primary-600 dark:text-cyan-400">{{ tasksStore.stats.total || 0 }}</div>
      <div class="text-sm text-gray-500 dark:text-slate-400 mt-1">Total Tasks</div>
    </div>

    <!-- Status Breakdown -->
    <div class="space-y-2">
      <div class="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-slate-700">
        <span class="text-gray-500 dark:text-slate-400">Completed</span>
        <span class="text-xs px-2 py-0.5 bg-green-100 text-green-800 dark:bg-emerald-900/40 dark:text-emerald-300 rounded">{{ tasksStore.stats.completed || 0 }}</span>
      </div>
      <div class="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-slate-700">
        <span class="text-gray-500 dark:text-slate-400">Executing</span>
        <span class="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-amber-900/40 dark:text-amber-300 rounded">{{ tasksStore.stats.executing || 0 }}</span>
      </div>
      <div class="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-slate-700 last:border-0">
        <span class="text-gray-500 dark:text-slate-400">Failed</span>
        <span class="text-xs px-2 py-0.5 bg-red-100 text-red-800 dark:bg-rose-900/40 dark:text-rose-300 rounded">{{ tasksStore.stats.failed || 0 }}</span>
      </div>
    </div>

    <router-link
      v-if="tasksStore.stats.total > 0"
      to="/tasks"
      class="block mt-4 text-center text-sm text-primary-600 hover:text-primary-700 dark:text-cyan-400 dark:hover:text-cyan-300"
    >
      View All →
    </router-link>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useTasksStore } from '../stores/tasks';

const tasksStore = useTasksStore();

onMounted(() => {
  tasksStore.fetchStats();
});
</script>
