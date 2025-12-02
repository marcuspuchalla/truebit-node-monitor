<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Preloader -->
    <Preloader />

    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center gap-3">
              <img src="/logo.png" alt="TruBit Watch" class="h-10 w-auto" />
              <h1 class="text-xl font-bold text-gray-900">TrueBit Node Monitor</h1>
            </div>
            <div class="hidden sm:ml-6 sm:flex sm:space-x-8">
              <router-link
                to="/"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="$route.name === 'federation' ? 'border-primary-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'"
              >
                Network
              </router-link>
              <router-link
                to="/dashboard"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="$route.name === 'dashboard' ? 'border-primary-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'"
              >
                Dashboard
              </router-link>
              <router-link
                to="/tasks"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="$route.name === 'tasks' || $route.name === 'task-detail' ? 'border-primary-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'"
              >
                Tasks
              </router-link>
              <router-link
                to="/invoices"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="$route.name === 'invoices' ? 'border-primary-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'"
              >
                Invoices
              </router-link>
              <router-link
                to="/logs"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="$route.name === 'logs' ? 'border-primary-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'"
              >
                Logs
              </router-link>
              <router-link
                to="/about"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="$route.name === 'about' ? 'border-primary-500 text-gray-900' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'"
              >
                About
              </router-link>
            </div>
          </div>
          <div class="flex items-center">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <span class="w-2 h-2 rounded-full mr-1.5 bg-green-500"></span>
              Connected
            </span>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import Preloader from './components/Preloader.vue';
import { usePreloader } from './composables/usePreloader';
import { useNodeStore } from './stores/node';
import { useTasksStore } from './stores/tasks';
import { useInvoicesStore } from './stores/invoices';

const { setProgress } = usePreloader();
const nodeStore = useNodeStore();
const tasksStore = useTasksStore();
const invoicesStore = useInvoicesStore();

onMounted(async () => {
  setProgress(10);

  // Load node status
  await nodeStore.fetchStatus();
  setProgress(40);

  // Load tasks
  await tasksStore.fetchTasks();
  setProgress(70);

  // Load invoices
  await invoicesStore.fetchInvoices();
  setProgress(90);

  // Complete loading
  setProgress(100);
});
</script>
