<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Logs</h1>

      <div class="flex space-x-2 bg-gray-100 p-1 rounded-lg">
        <button
          @click="activeView = 'realtime'"
          :class="activeView === 'realtime' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Real-time
        </button>
        <button
          @click="activeView = 'table'"
          :class="activeView === 'table' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors"
        >
          Table
        </button>
      </div>
    </div>

    <LogViewer v-if="activeView === 'realtime'" :max-logs="200" :auto-scroll="true" />
    <LogTable v-else />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import LogViewer from '../components/LogViewer.vue';
import LogTable from '../components/LogTable.vue';

const activeView = ref('table');
</script>
