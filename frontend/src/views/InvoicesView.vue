<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Payroll & Invoices</h1>

    <div v-if="invoicesStore.loading" class="text-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
    </div>

    <div v-else class="card">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900">
          All Invoices ({{ invoicesStore.totalCount }})
        </h2>
      </div>

      <div v-if="invoicesStore.invoices.length === 0" class="text-center py-8 text-gray-500">
        No invoices yet
      </div>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice ID
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Execution ID
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Steps Computed
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Peak Memory
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="invoice in invoicesStore.invoices" :key="invoice.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-mono text-gray-900">
                  {{ getInvoiceId(invoice) }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-mono text-gray-900">
                  {{ getExecutionId(invoice) }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(invoice.timestamp) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatNumber(getTotalSteps(invoice)) }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ getPeakMemory(invoice) }} KB
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm">
                <button
                  @click="selectedInvoice = invoice"
                  class="text-primary-600 hover:text-primary-900"
                >
                  View Details
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="invoicesStore.pagination.hasMore" class="mt-6 text-center">
        <button
          @click="loadMore"
          class="btn-primary"
        >
          Load More
        </button>
      </div>
    </div>

    <!-- Invoice Detail Modal -->
    <div
      v-if="selectedInvoice"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="selectedInvoice = null"
    >
      <div class="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">Invoice Details</h3>
          <button @click="selectedInvoice = null" class="text-gray-500 hover:text-gray-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="space-y-6">
          <!-- Summary -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <span class="text-sm font-medium text-gray-700">Invoice ID:</span>
              <p class="text-sm text-gray-900 font-mono">{{ getInvoiceId(selectedInvoice) }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-700">Execution ID:</span>
              <p class="text-sm text-gray-900 font-mono">{{ getExecutionId(selectedInvoice) }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-700">Task ID:</span>
              <p class="text-sm text-gray-900 font-mono break-all">{{ getTaskId(selectedInvoice) }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-700">Timestamp:</span>
              <p class="text-sm text-gray-900">{{ formatDate(selectedInvoice.timestamp) }}</p>
            </div>
          </div>

          <!-- Line Items -->
          <div v-if="getLineItems(selectedInvoice)">
            <h4 class="text-md font-semibold text-gray-900 mb-3">Line Items</h4>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Operation</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Steps Computed</th>
                    <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Peak Memory</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <tr v-for="(item, index) in getLineItems(selectedInvoice)" :key="index">
                    <td class="px-4 py-2 text-sm">
                      <span :class="item.operation === 'charge' ? 'badge-red' : 'badge-green'" class="badge">
                        {{ item.operation }}
                      </span>
                    </td>
                    <td class="px-4 py-2 text-sm font-mono">{{ item.account }}</td>
                    <td class="px-4 py-2 text-sm">{{ formatNumber(item.total_steps_computed) }}</td>
                    <td class="px-4 py-2 text-sm">{{ item.peak_memory_used }} KB</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Full JSON -->
          <div class="mt-4">
            <h4 class="text-md font-semibold text-gray-900 mb-3">Full Details (JSON)</h4>
            <pre class="mt-2 p-4 bg-gray-100 rounded text-xs overflow-x-auto max-h-96">{{ JSON.stringify(selectedInvoice.details, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useInvoicesStore } from '../stores/invoices';

const invoicesStore = useInvoicesStore();
const selectedInvoice = ref(null);

function getInvoiceId(invoice) {
  try {
    const details = typeof invoice.details === 'string' ? JSON.parse(invoice.details) : invoice.details;
    return details?.invoiceId || 'N/A';
  } catch {
    return 'N/A';
  }
}

function getExecutionId(invoice) {
  try {
    const details = typeof invoice.details === 'string' ? JSON.parse(invoice.details) : invoice.details;
    return details?.executionId?.substring(0, 8) + '...' || 'N/A';
  } catch {
    return 'N/A';
  }
}

function getTaskId(invoice) {
  try {
    const details = typeof invoice.details === 'string' ? JSON.parse(invoice.details) : invoice.details;
    return details?.taskId || 'N/A';
  } catch {
    return 'N/A';
  }
}

function getTotalSteps(invoice) {
  try {
    const details = typeof invoice.details === 'string' ? JSON.parse(invoice.details) : invoice.details;
    return details?.totalStepsComputed || details?.lineItem?.[0]?.total_steps_computed || 0;
  } catch {
    return 0;
  }
}

function getPeakMemory(invoice) {
  try {
    const details = typeof invoice.details === 'string' ? JSON.parse(invoice.details) : invoice.details;
    return details?.peakMemoryUsed || details?.lineItem?.[0]?.peak_memory_used || 'N/A';
  } catch {
    return 'N/A';
  }
}

function getLineItems(invoice) {
  try {
    const details = typeof invoice.details === 'string' ? JSON.parse(invoice.details) : invoice.details;
    return details?.lineItems || details?.lineItem || null;
  } catch {
    return null;
  }
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

function loadMore() {
  invoicesStore.fetchInvoices({
    limit: 50,
    offset: invoicesStore.pagination.offset + invoicesStore.pagination.limit
  });
}

onMounted(() => {
  invoicesStore.fetchInvoices({ limit: 50 });
  invoicesStore.fetchCount();
});
</script>
