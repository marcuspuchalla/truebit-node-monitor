<template>
  <div class="card">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Tasks Summary</h2>
    <div class="grid grid-cols-4 gap-4 text-center">
      <div>
        <div class="text-3xl font-bold">{{ tasksStore.stats.total || 0 }}</div>
        <div class="text-sm text-gray-500 mt-1">Total</div>
      </div>
      <div>
        <div class="text-3xl font-bold text-green-600">{{ tasksStore.stats.completed || 0 }}</div>
        <div class="text-sm text-gray-500 mt-1">Completed</div>
      </div>
      <div>
        <div class="text-3xl font-bold text-yellow-600">{{ tasksStore.stats.executing || 0 }}</div>
        <div class="text-sm text-gray-500 mt-1">Executing</div>
      </div>
      <div>
        <div class="text-3xl font-bold text-red-600">{{ tasksStore.stats.failed || 0 }}</div>
        <div class="text-sm text-gray-500 mt-1">Failed</div>
      </div>
    </div>

    <div v-if="tasksStore.stats.avg_gas_used" class="mt-4 pt-4 border-t border-gray-200">
      <div class="text-sm text-gray-500">
        <div class="flex justify-between">
          <span>Avg Gas Used:</span>
          <span class="font-semibold">{{ formatNumber(tasksStore.stats.avg_gas_used) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useTasksStore } from '../stores/tasks';

const tasksStore = useTasksStore();

function formatNumber(num) {
  if (!num) return 'N/A';
  return num.toLocaleString();
}

onMounted(() => {
  tasksStore.fetchStats();
});
</script>
