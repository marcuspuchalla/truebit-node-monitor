<template>
  <div class="space-y-6">
    <!-- Warning Banner -->
    <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-yellow-800">
            <strong>Unofficial Monitor</strong> - This tool is not affiliated with TrueBit. Use at your own risk.
            <router-link to="/about" class="font-semibold underline hover:text-yellow-900">Read the full disclaimer →</router-link>
          </p>
        </div>
      </div>
    </div>

    <!-- Three Summary Cards in One Row -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <NodeStatus />
      <InvoiceSummary />
      <TaskSummary />
    </div>

    <TaskTable :tasks="tasksStore.recentTasks" title="Recent Tasks" :show-view-all="true" />

    <LogViewer :max-logs="50" :auto-scroll="true" />

    <!-- Federation Settings -->
    <div class="bg-white rounded-lg shadow p-4">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-medium text-gray-900">Network Participation</h3>
          <p class="text-xs text-gray-500 mt-1">
            {{ federationSettings?.enabled ? 'Sharing anonymized statistics with the network' : 'Not participating in network statistics' }}
          </p>
        </div>
        <button
          @click="toggleFederation"
          class="federation-toggle"
          :class="{ 'enabled': federationSettings?.enabled }"
          :disabled="isToggling"
        >
          {{ isToggling ? 'Updating...' : (federationSettings?.enabled ? 'Leave Network' : 'Join Network') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import NodeStatus from '../components/NodeStatus.vue';
import TaskSummary from '../components/TaskSummary.vue';
import TaskTable from '../components/TaskTable.vue';
import LogViewer from '../components/LogViewer.vue';
import InvoiceSummary from '../components/InvoiceSummary.vue';
import { useTasksStore } from '../stores/tasks';
import { useFederationStore } from '../stores/federation';

const tasksStore = useTasksStore();
const federationStore = useFederationStore();

const { settings: federationSettings } = storeToRefs(federationStore);
const isToggling = ref(false);

async function toggleFederation() {
  isToggling.value = true;
  try {
    if (federationSettings.value?.enabled) {
      await federationStore.disableFederation();
    } else {
      await federationStore.enableFederation();
    }
    await federationStore.fetchStatus();
  } catch (error) {
    console.error('Federation toggle error:', error);
  } finally {
    isToggling.value = false;
  }
}

onMounted(() => {
  tasksStore.fetchTasks({ limit: 10 });
  federationStore.fetchSettings();
});
</script>

<style scoped>
.federation-toggle {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
}

.federation-toggle:hover:not(:disabled) {
  background: #f3f4f6;
}

.federation-toggle.enabled {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #991b1b;
}

.federation-toggle.enabled:hover:not(:disabled) {
  background: #fecaca;
}

.federation-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
