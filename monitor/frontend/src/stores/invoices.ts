import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api, { type Invoice, type Pagination, type InvoicesParams } from '../services/api';

export const useInvoicesStore = defineStore('invoices', () => {
  const invoices = ref<Invoice[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const totalCount = ref(0);
  const pagination = ref<Pagination>({
    limit: 50,
    offset: 0,
    hasMore: false
  });

  const recentInvoices = computed(() =>
    invoices.value.slice(0, 10)
  );

  async function fetchInvoices(params: InvoicesParams = {}): Promise<void> {
    try {
      loading.value = true;
      error.value = null;

      const limit = params.limit || pagination.value.limit;
      const offset = params.offset || 0;

      const data = await api.getInvoices({ limit, offset });

      if (offset === 0) {
        invoices.value = data.invoices;
      } else {
        invoices.value = [...invoices.value, ...data.invoices];
      }

      pagination.value.limit = limit;
      pagination.value.offset = offset;
      pagination.value.hasMore = data.invoices.length === limit;
    } catch (err) {
      error.value = (err as Error).message;
      console.error('Failed to fetch invoices:', err);
    } finally {
      loading.value = false;
    }
  }

  async function fetchCount(): Promise<void> {
    try {
      const data = await api.getInvoiceCount();
      totalCount.value = data.count;
    } catch (err) {
      console.error('Failed to fetch invoice count:', err);
    }
  }

  function addInvoice(invoice: Invoice): void {
    invoices.value.unshift(invoice);
    totalCount.value++;
  }

  return {
    invoices,
    loading,
    error,
    totalCount,
    pagination,
    recentInvoices,
    fetchInvoices,
    fetchCount,
    addInvoice
  };
});
