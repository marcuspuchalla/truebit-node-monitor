<template>
  <div class="card task-table-card">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400">{{ title || 'Tasks' }}</h2>
      <router-link
        v-if="showViewAll && tasks.length > 0"
        to="/tasks"
        class="text-sm text-primary-600 hover:text-primary-700 dark:text-cyan-400 dark:hover:text-cyan-300"
      >
        View All →
      </router-link>
    </div>

    <div v-if="tasks.length === 0" class="text-center py-8 text-gray-500 dark:text-slate-400">
      No tasks yet
    </div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-[#1a3a5c]">
        <thead class="bg-gray-50 dark:bg-[#0a0f1a]">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-cyan-400/70 uppercase tracking-wider">
              Execution ID
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-cyan-400/70 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-cyan-400/70 uppercase tracking-wider">
              Task Type
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-cyan-400/70 uppercase tracking-wider">
              Gas Used
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-cyan-400/70 uppercase tracking-wider">
              Received At
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-cyan-400/70 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-[#050810] divide-y divide-gray-200 dark:divide-[#1a3a5c]">
          <tr v-for="task in tasks" :key="task.id" class="hover:bg-gray-50 dark:hover:bg-[#0d1424] transition-colors">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-mono text-gray-900 dark:text-cyan-300">
                {{ task.execution_id ? task.execution_id.substring(0, 8) + '...' : 'N/A' }}
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="getStatusBadgeClass(task.status)" class="px-2 py-1 text-xs font-semibold rounded-full">
                {{ task.status || 'unknown' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900 dark:text-slate-200 font-mono truncate max-w-xs">
                {{ task.task_type || 'N/A' }}
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
              {{ formatNumber(task.gas_used) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
              {{ formatDate(task.received_at) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
              <router-link
                :to="`/tasks/${task.execution_id}`"
                class="text-primary-600 hover:text-primary-900 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                View Details
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
defineProps({
  tasks: {
    type: Array,
    default: () => []
  },
  title: {
    type: String,
    default: ''
  },
  showViewAll: {
    type: Boolean,
    default: true
  }
});

function getStatusBadgeClass(status) {
  const classes = {
    received: 'bg-blue-100 text-blue-800 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border dark:border-cyan-500/30',
    executing: 'bg-yellow-100 text-yellow-800 dark:bg-amber-900/30 dark:text-amber-300 dark:border dark:border-amber-500/30',
    completed: 'bg-green-100 text-green-800 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border dark:border-emerald-500/30',
    failed: 'bg-red-100 text-red-800 dark:bg-rose-900/30 dark:text-rose-300 dark:border dark:border-rose-500/30'
  };
  return classes[status] || 'bg-gray-100 text-gray-800 dark:bg-slate-800/50 dark:text-slate-300 dark:border dark:border-slate-600/30';
}

function formatNumber(num) {
  if (!num) return 'N/A';
  return num.toLocaleString();
}

function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString();
}
</script>
