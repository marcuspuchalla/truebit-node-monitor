<template>
  <div class="card">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold text-gray-900">{{ title || 'Tasks' }}</h2>
      <router-link
        v-if="showViewAll && tasks.length > 0"
        to="/tasks"
        class="text-sm text-primary-600 hover:text-primary-700"
      >
        View All →
      </router-link>
    </div>

    <div v-if="tasks.length === 0" class="text-center py-8 text-gray-500">
      No tasks yet
    </div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Execution ID
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Task Type
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Gas Used
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Received At
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="task in tasks" :key="task.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-mono text-gray-900">
                {{ task.execution_id.substring(0, 8) }}...
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span :class="getStatusBadgeClass(task.status)" class="px-2 py-1 text-xs font-semibold rounded-full">
                {{ task.status }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm text-gray-900 font-mono truncate max-w-xs">
                {{ task.task_type }}
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatNumber(task.gas_used) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatDate(task.received_at) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
              <router-link
                :to="`/tasks/${task.execution_id}`"
                class="text-primary-600 hover:text-primary-900"
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
    received: 'bg-blue-100 text-blue-800',
    executing: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800'
  };
  return classes[status] || 'bg-gray-100 text-gray-800';
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
