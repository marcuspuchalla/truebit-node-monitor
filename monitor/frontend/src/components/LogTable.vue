<template>
  <div class="card">
    <!-- Filters -->
    <div class="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <!-- Level Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Log Level</label>
          <select
            v-model="filters.level"
            @change="applyFilters"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option :value="null">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>

        <!-- Type Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Log Type</label>
          <select
            v-model="filters.type"
            @change="applyFilters"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option :value="null">All Types</option>
            <option value="task_received">Task Received</option>
            <option value="task_start">Task Start</option>
            <option value="task_completed">Task Completed</option>
            <option value="task_download">Task Download</option>
            <option value="task_published">Task Published</option>
            <option value="semaphore">Semaphore</option>
            <option value="invoice">Invoice</option>
            <option value="registration">Registration</option>
            <option value="info">Info</option>
            <option value="raw">Raw</option>
          </select>
        </div>

        <!-- Message Search -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Search Message</label>
          <input
            v-model="filters.search"
            @input="debouncedFilter"
            type="text"
            placeholder="Search in messages..."
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          />
        </div>
      </div>

      <!-- Clear Filters Button -->
      <div class="mt-3 flex justify-end">
        <button
          @click="clearFilters"
          class="text-sm text-gray-600 hover:text-gray-900 underline"
        >
          Clear Filters
        </button>
      </div>
    </div>

    <div v-if="logsStore.loading" class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
    </div>

    <div v-else-if="parsedLogs.length === 0" class="text-center py-8 text-gray-500">
      No logs available
    </div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="w-12 px-4 py-3"></th>
            <th
              @click="toggleSort"
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
            >
              <div class="flex items-center gap-2">
                <span>Timestamp</span>
                <svg
                  class="w-4 h-4 transition-transform"
                  :class="{ 'rotate-180': sortOrder === 'asc' }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Level
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Message
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <template v-for="(log, index) in parsedLogs" :key="log.id">
            <!-- Main Row -->
            <tr
              @click="toggleExpand(log.id)"
              class="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td class="px-4 py-3 text-center">
                <svg
                  class="w-4 h-4 text-gray-400 transition-transform inline-block"
                  :class="{ 'rotate-90': expandedRows.has(log.id) }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                </svg>
              </td>
              <td class="px-6 py-3 whitespace-nowrap text-sm text-gray-900">
                {{ formatTimestamp(log.timestamp, log.timestamp_original) }}
              </td>
              <td class="px-6 py-3 whitespace-nowrap">
                <span :class="getLevelClass(log.level)" class="px-2 py-1 text-xs font-medium rounded">
                  {{ log.level }}
                </span>
              </td>
              <td class="px-6 py-3 whitespace-nowrap">
                <span :class="getTypeClass(log.type)" class="px-2 py-1 text-xs font-medium rounded">
                  {{ log.type }}
                </span>
              </td>
              <td class="px-6 py-3 text-sm text-gray-700">
                {{ log.summary }}
              </td>
            </tr>

            <!-- Expanded Details Row -->
            <tr v-if="expandedRows.has(log.id)" class="bg-gray-50">
              <td colspan="5" class="px-6 py-4">
                <div class="space-y-4">
                  <!-- Parsed Fields -->
                  <div v-if="log.parsed && Object.keys(log.parsed).length > 0" class="space-y-3">
                    <h4 class="text-sm font-semibold text-gray-900">Parsed Information</h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div v-for="(value, key) in log.parsed" :key="key" class="bg-white p-3 rounded border border-gray-200">
                        <div class="text-xs font-medium text-gray-500 uppercase mb-1">{{ key }}</div>
                        <div class="text-sm text-gray-900">
                          <!-- Handle different value types -->
                          <template v-if="typeof value === 'object' && value !== null">
                            <pre class="text-xs bg-gray-50 p-2 rounded overflow-x-auto">{{ JSON.stringify(value, null, 2) }}</pre>
                          </template>
                          <template v-else-if="typeof value === 'boolean'">
                            <span :class="value ? 'text-green-600' : 'text-red-600'">{{ value }}</span>
                          </template>
                          <template v-else>
                            <span class="font-mono">{{ value }}</span>
                          </template>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Raw Message -->
                  <div>
                    <h4 class="text-sm font-semibold text-gray-900 mb-2">Raw Message</h4>
                    <pre class="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">{{ log.message }}</pre>
                  </div>

                  <!-- JSON Data if available -->
                  <div v-if="log.data">
                    <h4 class="text-sm font-semibold text-gray-900 mb-2">Additional Data</h4>
                    <pre class="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto">{{ formatJSON(log.data) }}</pre>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Load More Button -->
      <div v-if="parsedLogs.length >= limit" class="mt-6 text-center">
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
import { ref, computed, onMounted, watch } from 'vue';
import { useLogsStore } from '../stores/logs';

const logsStore = useLogsStore();
const expandedRows = ref(new Set());
const limit = ref(100);

// Filter state
const filters = ref({
  level: null,
  type: null,
  search: ''
});

// Sort state - default to descending (newest first)
const sortOrder = ref('desc');

let filterTimeout = null;

// Parse logs to extract structured information
const parsedLogs = computed(() => {
  const logs = logsStore.logs.map(log => {
    const parsed = parseLogMessage(log);
    return {
      ...log,
      summary: getSummary(log, parsed),
      parsed
    };
  });

  // Sort by timestamp
  return logs.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();

    if (sortOrder.value === 'asc') {
      return timeA - timeB; // Oldest first
    } else {
      return timeB - timeA; // Newest first (default)
    }
  });
});

function parseLogMessage(log) {
  const fields = {};
  const message = log.message || '';

  // Parse execution ID
  const execIdMatch = message.match(/executionId['":\s]+([a-f0-9-]+)/i);
  if (execIdMatch) {
    fields.executionId = execIdMatch[1];
  }

  // Parse semaphore slots
  const slotMatch = message.match(/Using slot (\d+)\/(\d+)/);
  if (slotMatch) {
    fields.slotUsed = slotMatch[1];
    fields.totalSlots = slotMatch[2];
  }

  const releaseMatch = message.match(/Released slot \((\d+)\/(\d+) now active\)/);
  if (releaseMatch) {
    fields.activeSlots = releaseMatch[1];
    fields.totalSlots = releaseMatch[2];
  }

  // Parse task completion
  const completedMatch = message.match(/Execution ([a-f0-9-]+) completed/);
  if (completedMatch) {
    fields.executionId = completedMatch[1];
    fields.status = 'completed';
  }

  // Parse node address
  const addressMatch = message.match(/Node with address (0x[0-9A-Fa-f]+)/);
  if (addressMatch) {
    fields.nodeAddress = addressMatch[1];
  }

  // Parse version
  const versionMatch = message.match(/@truebit\/worker-runner-node(?:-[0-9A-Fa-fx]+)?:([0-9.-]+(?:-beta\.\d+)?)/);
  if (versionMatch) {
    fields.version = versionMatch[1];
  }

  // Parse message type from content
  if (message.includes('Message received from')) {
    const typeMatch = message.match(/Message received from (\w+):/);
    if (typeMatch) {
      fields.messageType = typeMatch[1];
    }
  }

  if (message.includes('Message published to')) {
    const typeMatch = message.match(/Message published to (\w+)/);
    if (typeMatch) {
      fields.publishedTo = typeMatch[1];
    }
  }

  // Parse subscriber info
  if (message.includes('Semaphore') && message.includes('Subscriber')) {
    const subscriberMatch = message.match(/Semaphore (\w+)/);
    if (subscriberMatch) {
      fields.subscriber = subscriberMatch[1];
    }

    if (message.includes('processing started')) {
      fields.action = 'started';
    } else if (message.includes('processing completed')) {
      fields.action = 'completed';
    } else if (message.includes('message received')) {
      fields.action = 'received';
    }
  }

  // Parse task download
  if (message.includes('Task') && message.includes('downloaded successfully')) {
    const taskMatch = message.match(/Task ([a-zA-Z0-9]+) downloaded/);
    if (taskMatch) {
      fields.taskHash = taskMatch[1];
    }
  }

  // If log has data field, try to extract key fields
  if (log.data) {
    try {
      const data = typeof log.data === 'string' ? JSON.parse(log.data) : log.data;

      if (data.invoiceId) fields.invoiceId = data.invoiceId;
      if (data.taskId) fields.taskId = data.taskId;
      if (data.chainId) fields.chainId = data.chainId;
      if (data.blockNumber) fields.blockNumber = data.blockNumber;
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  return fields;
}

function getSummary(log, parsed) {
  const message = log.message || '';

  // For semaphore messages, create a concise summary
  if (log.type === 'semaphore') {
    if (parsed.action === 'started') {
      return `${parsed.subscriber} processing started (slot ${parsed.slotUsed}/${parsed.totalSlots})`;
    } else if (parsed.action === 'completed') {
      return `${parsed.subscriber} processing completed (${parsed.activeSlots}/${parsed.totalSlots} active)`;
    } else if (parsed.action === 'received') {
      return `${parsed.subscriber} message received`;
    }
  }

  // For task messages
  if (log.type === 'task_received' && parsed.executionId) {
    return `Task received: ${parsed.executionId.substring(0, 8)}...`;
  }

  if (log.type === 'task_completed' && parsed.executionId) {
    return `Task completed: ${parsed.executionId.substring(0, 8)}...`;
  }

  if (log.type === 'task_download' && parsed.taskHash) {
    return `Task ${parsed.taskHash} downloaded successfully`;
  }

  // For registration
  if (log.type === 'registration' && parsed.nodeAddress) {
    return `Node ${parsed.nodeAddress.substring(0, 10)}... registration`;
  }

  // For invoice
  if (log.type === 'invoice' && parsed.invoiceId) {
    return `Invoice: ${parsed.invoiceId}`;
  }

  // Default: use first 100 chars of message
  return message.length > 100 ? message.substring(0, 100) + '...' : message;
}

function toggleExpand(logId) {
  if (expandedRows.value.has(logId)) {
    expandedRows.value.delete(logId);
  } else {
    expandedRows.value.add(logId);
  }
  // Trigger reactivity
  expandedRows.value = new Set(expandedRows.value);
}

function formatTimestamp(timestamp, timestampOriginal) {
  // Use original timestamp from log file if available
  if (timestampOriginal) {
    return timestampOriginal;
  }

  // Fallback to parsed timestamp
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString('en-US', { hour12: false });
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${time}.${ms}`;
}

function getLevelClass(level) {
  const classes = {
    info: 'bg-blue-100 text-blue-800',
    warn: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    debug: 'bg-gray-100 text-gray-800'
  };
  return classes[level] || 'bg-gray-100 text-gray-800';
}

function getTypeClass(type) {
  const classes = {
    task_received: 'bg-green-100 text-green-800',
    task_start: 'bg-blue-100 text-blue-800',
    task_completed: 'bg-purple-100 text-purple-800',
    task_download: 'bg-cyan-100 text-cyan-800',
    semaphore: 'bg-orange-100 text-orange-800',
    invoice: 'bg-pink-100 text-pink-800',
    registration: 'bg-indigo-100 text-indigo-800',
    raw: 'bg-gray-100 text-gray-600',
    info: 'bg-gray-100 text-gray-600'
  };
  return classes[type] || 'bg-gray-100 text-gray-600';
}

function formatJSON(data) {
  try {
    const obj = typeof data === 'string' ? JSON.parse(data) : data;
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return data;
  }
}

function loadMore() {
  limit.value += 100;
  logsStore.fetchLogs({
    limit: limit.value,
    level: filters.value.level,
    type: filters.value.type,
    search: filters.value.search
  });
}

function applyFilters() {
  logsStore.fetchLogs({
    limit: limit.value,
    level: filters.value.level,
    type: filters.value.type,
    search: filters.value.search
  });
}

function debouncedFilter() {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(() => {
    applyFilters();
  }, 500); // Wait 500ms after user stops typing
}

function clearFilters() {
  filters.value = {
    level: null,
    type: null,
    search: ''
  };
  applyFilters();
}

function toggleSort() {
  sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
}

onMounted(() => {
  logsStore.fetchLogs({ limit: limit.value });
});
</script>
