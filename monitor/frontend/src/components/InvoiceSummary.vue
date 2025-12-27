<template>
  <div class="card">
    <h2 class="text-lg font-semibold text-gray-900 dark:text-cyan-400 mb-4">Payroll Summary</h2>

    <!-- Total Count -->
    <div class="text-center mb-4">
      <div class="text-4xl font-bold text-primary-600 dark:text-cyan-400">{{ invoicesStore.totalCount }}</div>
      <div class="text-sm text-gray-500 dark:text-slate-400 mt-1">Total Invoices</div>
    </div>

    <!-- Recent Events -->
    <div class="space-y-2">
      <div
        v-for="invoice in invoicesStore.recentInvoices.slice(0, 3)"
        :key="invoice.id"
        class="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-slate-700 last:border-0"
      >
        <span class="text-gray-500 dark:text-slate-400">{{ formatDate(invoice.timestamp) }}</span>
        <span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-cyan-900/40 dark:text-cyan-300 rounded">Invoice</span>
      </div>
      <div v-if="invoicesStore.recentInvoices.length === 0" class="text-center text-gray-500 dark:text-slate-400 text-sm py-2">
        No invoices yet
      </div>
    </div>

    <router-link
      v-if="invoicesStore.totalCount > 0"
      to="/invoices"
      class="block mt-4 text-center text-sm text-primary-600 hover:text-primary-700 dark:text-cyan-400 dark:hover:text-cyan-300"
    >
      View All →
    </router-link>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useInvoicesStore } from '../stores/invoices';

const invoicesStore = useInvoicesStore();

function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString();
}

onMounted(() => {
  invoicesStore.fetchInvoices({ limit: 5 });
  invoicesStore.fetchCount();
});
</script>
