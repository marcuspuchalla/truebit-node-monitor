<template>
  <div class="card">
    <h2 class="text-lg font-semibold text-gray-900 mb-4">Payroll Summary</h2>

    <div class="text-center mb-6">
      <div class="text-4xl font-bold text-primary-600">{{ invoicesStore.totalCount }}</div>
      <div class="text-sm text-gray-500 mt-1">Total Invoices</div>
    </div>

    <div v-if="invoicesStore.recentInvoices.length > 0" class="space-y-2">
      <h3 class="text-sm font-medium text-gray-700">Recent Events</h3>
      <div
        v-for="invoice in invoicesStore.recentInvoices.slice(0, 5)"
        :key="invoice.id"
        @click="selectedInvoice = invoice"
        class="flex justify-between items-center py-2 border-b border-gray-200 last:border-0 cursor-pointer hover:bg-gray-50 rounded px-2"
      >
        <span class="text-xs text-gray-500">{{ formatDate(invoice.timestamp) }}</span>
        <span class="badge badge-blue">Invoice</span>
      </div>
    </div>

    <div v-else class="text-center py-4 text-gray-500 text-sm">
      No invoice events yet
    </div>

    <!-- Invoice Detail Modal -->
    <div
      v-if="selectedInvoice"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="selectedInvoice = null"
    >
      <div class="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold">Invoice Details</h3>
          <button @click="selectedInvoice = null" class="text-gray-500 hover:text-gray-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <span class="text-sm font-medium text-gray-700">Timestamp:</span>
              <p class="text-sm text-gray-900">{{ formatDate(selectedInvoice.timestamp) }}</p>
            </div>
            <div>
              <span class="text-sm font-medium text-gray-700">Event Type:</span>
              <p class="text-sm text-gray-900">{{ selectedInvoice.event_type }}</p>
            </div>
          </div>

          <div v-if="selectedInvoice.details" class="mt-4">
            <span class="text-sm font-medium text-gray-700">Full Details:</span>
            <pre class="mt-2 p-4 bg-gray-100 rounded text-xs overflow-x-auto">{{ JSON.stringify(selectedInvoice.details, null, 2) }}</pre>
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

function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleString();
}

onMounted(() => {
  invoicesStore.fetchInvoices({ limit: 10 });
  invoicesStore.fetchCount();
});
</script>
