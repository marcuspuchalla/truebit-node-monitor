<template>
  <div class="space-y-6">
    <div class="flex items-center space-x-4">
      <button @click="$router.back()" class="text-gray-600 hover:text-gray-900">
        ← Back
      </button>
      <h1 class="text-2xl font-bold text-gray-900">Task Details</h1>
    </div>

    <div v-if="tasksStore.loading" class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
    </div>

    <div v-else-if="task" class="space-y-6">
      <div class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">General Information</h2>
          <span :class="getStatusBadge(task.status)">
            {{ task.status }}
          </span>
        </div>

        <dl class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt class="text-sm font-medium text-gray-500">Execution ID</dt>
            <dd class="mt-1 text-sm text-gray-900 font-mono">{{ task.execution_id }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Task Type</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ task.task_type || 'N/A' }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Chain ID</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ task.chain_id || 'N/A' }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Block Number</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ task.block_number || 'N/A' }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Received At</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ formatDate(task.received_at) }}</dd>
          </div>
          <div v-if="task.completed_at">
            <dt class="text-sm font-medium text-gray-500">Completed At</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ formatDate(task.completed_at) }}</dd>
          </div>
        </dl>
      </div>

      <div v-if="task.elapsed_ms" class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Execution Metrics</h2>

        <dl class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <dt class="text-sm font-medium text-gray-500">Execution Time</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ formatTime(task.elapsed_ms) }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Gas Used</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ formatNumber(task.gas_used) }}</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Memory Peak</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ task.memory_peak || 'N/A' }} MB</dd>
          </div>
          <div>
            <dt class="text-sm font-medium text-gray-500">Exit Code</dt>
            <dd class="mt-1 text-sm text-gray-900">{{ task.exit_code ?? 'N/A' }}</dd>
          </div>
        </dl>
      </div>

      <!-- Sensitive Data Section -->
      <div v-if="task.hasSensitiveData" class="card">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900">Task Input/Output Data</h2>
          <span v-if="task.sensitiveDataRequiresAuth && !sensitiveDataLoaded" class="text-sm text-amber-600">
            Password required
          </span>
        </div>

        <!-- Password prompt if auth required and data not loaded -->
        <div v-if="task.sensitiveDataRequiresAuth && !sensitiveDataLoaded && !sensitiveDataError" class="space-y-4">
          <p class="text-sm text-gray-600">
            Task input/output data is protected. Enter your password to view.
          </p>
          <div class="flex gap-2">
            <input
              v-model="password"
              type="password"
              placeholder="Enter task data password"
              class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              @keyup.enter="loadSensitiveData"
            />
            <button
              @click="loadSensitiveData"
              :disabled="loadingSensitiveData"
              class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
            >
              {{ loadingSensitiveData ? 'Loading...' : 'View Data' }}
            </button>
          </div>
        </div>

        <!-- Error message -->
        <div v-if="sensitiveDataError" class="text-red-600 text-sm mb-4">
          {{ sensitiveDataError }}
          <button @click="sensitiveDataError = ''" class="ml-2 text-primary-600 underline">Try again</button>
        </div>

        <!-- Load button if no auth required -->
        <div v-if="!task.sensitiveDataRequiresAuth && !sensitiveDataLoaded && !sensitiveDataError" class="space-y-4">
          <button
            @click="loadSensitiveData"
            :disabled="loadingSensitiveData"
            class="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
          >
            {{ loadingSensitiveData ? 'Loading...' : 'Load Input/Output Data' }}
          </button>
        </div>

        <!-- Display sensitive data when loaded -->
        <div v-if="sensitiveDataLoaded" class="space-y-6">
          <div v-if="sensitiveData?.inputData">
            <h3 class="text-md font-semibold text-gray-800 mb-3">Input Data</h3>
            <div class="space-y-4">
              <div v-for="(value, key) in sensitiveData.inputData" :key="key">
                <dt class="text-sm font-medium text-gray-700 mb-2">{{ key }}:</dt>
                <dd v-if="key === 'source' && typeof value === 'string'" class="mt-1">
                  <pre class="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm">{{ value }}</pre>
                </dd>
                <dd v-else-if="typeof value === 'string'" class="mt-1">
                  <div class="bg-gray-50 rounded-lg p-3 text-sm font-mono">{{ value }}</div>
                </dd>
                <dd v-else class="mt-1">
                  <pre class="bg-gray-50 rounded-lg p-3 overflow-x-auto text-sm">{{ JSON.stringify(value, null, 2) }}</pre>
                </dd>
              </div>
            </div>
          </div>

          <div v-if="sensitiveData?.outputData">
            <h3 class="text-md font-semibold text-gray-800 mb-3">Output Data</h3>
            <pre class="bg-gray-50 rounded-lg p-4 overflow-x-auto text-xs">{{ JSON.stringify(sensitiveData.outputData, null, 2) }}</pre>
          </div>

          <div v-if="!sensitiveData?.inputData && !sensitiveData?.outputData" class="text-gray-500 text-sm">
            No input/output data available for this task.
          </div>
        </div>
      </div>

      <!-- No sensitive data available -->
      <div v-else class="card">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Task Input/Output Data</h2>
        <p class="text-gray-500 text-sm">No input/output data recorded for this task.</p>
      </div>
    </div>

    <div v-else class="card text-center py-12 text-gray-500">
      Task not found
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useTasksStore } from '../stores/tasks';
import api from '../services/api';

const route = useRoute();
const tasksStore = useTasksStore();

const task = computed(() => tasksStore.currentTask);
const password = ref('');
const sensitiveData = ref(null);
const sensitiveDataLoaded = ref(false);
const sensitiveDataError = ref('');
const loadingSensitiveData = ref(false);

async function loadSensitiveData() {
  if (!task.value) return;

  loadingSensitiveData.value = true;
  sensitiveDataError.value = '';

  try {
    const headers = {};
    if (task.value.sensitiveDataRequiresAuth && password.value) {
      headers['X-Task-Data-Password'] = password.value;
    }

    const response = await fetch(`/api/tasks/${task.value.execution_id}/data`, { headers });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to load data');
    }

    sensitiveData.value = data;
    sensitiveDataLoaded.value = true;
  } catch (error) {
    sensitiveDataError.value = error.message || 'Failed to load sensitive data';
  } finally {
    loadingSensitiveData.value = false;
  }
}

function getStatusBadge(status) {
  const badges = {
    completed: 'badge-green',
    executing: 'badge-yellow',
    failed: 'badge-red',
    received: 'badge-blue'
  };
  return `badge ${badges[status] || 'badge-gray'}`;
}

function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatNumber(num) {
  if (!num) return 'N/A';
  return num.toLocaleString();
}

function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString();
}

onMounted(() => {
  tasksStore.fetchTask(route.params.id);
});
</script>
