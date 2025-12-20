<template>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900 dark:text-slate-100">{{ title || 'Tasks' }}</h2>
      <router-link
        v-if="showViewAll && tasks.length > 0"
        to="/tasks"
        class="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
      >
        View All →
      </router-link>
    </div>

    <div v-if="tasks.length === 0" class="text-center py-8 text-gray-500 dark:text-slate-400">
      No tasks yet
    </div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
        <thead class="bg-gray-50 dark:bg-slate-800">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
              Execution ID
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
              Task Type
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
              Gas Used
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
              Received At
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
          <tr v-for="task in tasks" :key="task.id" class="hover:bg-gray-50 dark:hover:bg-slate-800">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-mono text-gray-900 dark:text-slate-100">
                {{ task.execution_id ? task.execution_id.substring(0, 8) + '...' : 'N/A' }}
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="getStatusBadgeClass(task.status)" class="px-2 py-1 text-xs font-semibold rounded-full">
                {{ task.status || 'unknown' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900 dark:text-slate-100 font-mono truncate max-w-xs">
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
                class="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300"
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
    received: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
    executing: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
  };
  return classes[status] || 'bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-200';
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
