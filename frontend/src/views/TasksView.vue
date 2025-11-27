<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Tasks</h1>
      <div class="flex items-center space-x-4">
        <select
          v-model="statusFilter"
          class="border-gray-300 rounded-md"
          @change="loadTasks"
        >
          <option value="">All Status</option>
          <option value="received">Received</option>
          <option value="executing">Executing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>
    </div>

    <div v-if="tasksStore.loading" class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
    </div>

    <div v-else>
      <TaskTable :tasks="tasksStore.tasks" title="All Tasks" :show-view-all="false" />

      <div v-if="tasksStore.pagination.hasMore" class="mt-6 text-center">
        <button
          @click="loadMore"
          class="btn-primary"
        >
          Load More
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import TaskTable from '../components/TaskTable.vue';
import { useTasksStore } from '../stores/tasks';

const tasksStore = useTasksStore();
const statusFilter = ref('');

function loadTasks() {
  tasksStore.fetchTasks({
    status: statusFilter.value || null,
    limit: 50,
    offset: 0
  });
}

function loadMore() {
  tasksStore.fetchTasks({
    status: statusFilter.value || null,
    limit: 50,
    offset: tasksStore.pagination.offset + tasksStore.pagination.limit
  });
}

onMounted(() => {
  loadTasks();
});
</script>
