<template>
  <div class="min-h-screen bg-gray-50 dark:bg-[#050810]">
    <!-- Preloader - only shows during initial load -->
    <Preloader />

    <nav class="bg-white dark:bg-[#0a0f1a] shadow-sm border-b border-gray-200 dark:border-[#1a3a5c] dark:shadow-[0_1px_10px_rgba(0,212,255,0.1)]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <div class="flex">
            <div class="flex-shrink-0 flex items-center gap-3">
              <img src="/logo.png" alt="TruBit Watch" class="h-10 w-auto" />
              <div class="flex flex-col">
                <h1 class="text-xl font-bold text-gray-900 dark:text-slate-100">TrueBit Node Monitor</h1>
                <span class="text-xs text-gray-400 dark:text-slate-400">Global Network Statistics</span>
              </div>
            </div>
            <div class="hidden sm:ml-6 sm:flex sm:space-x-6">
              <!-- Network -->
              <router-link
                to="/"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="$route.name === 'federation' ? 'border-primary-500 text-gray-900 dark:text-slate-100' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'"
              >
                Network
              </router-link>

              <!-- Analytics Dropdown -->
              <div class="relative h-full flex items-center" @mouseenter="openDropdown = 'analytics'" @mouseleave="openDropdown = null">
                <button
                  class="inline-flex items-center gap-1 px-1 pt-1 border-b-2 text-sm font-medium"
                  :class="isAnalyticsActive ? 'border-primary-500 text-gray-900 dark:text-slate-100' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'"
                >
                  Analytics
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  v-show="openDropdown === 'analytics'"
                  class="absolute left-0 top-full w-40 bg-white dark:bg-[#0d1424] rounded-md shadow-lg border border-gray-200 dark:border-[#1a3a5c] z-50"
                >
                  <router-link to="/contracts" class="dropdown-item" @click="openDropdown = null">Contracts</router-link>
                  <router-link to="/token" class="dropdown-item" @click="openDropdown = null">Token</router-link>
                  <router-link to="/nodes" class="dropdown-item" @click="openDropdown = null">Nodes</router-link>
                  <router-link to="/staking" class="dropdown-item" @click="openDropdown = null">Staking</router-link>
                </div>
              </div>

              <!-- About -->
              <router-link
                to="/about"
                class="inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                :class="$route.name === 'about' ? 'border-primary-500 text-gray-900 dark:text-slate-100' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'"
              >
                About
              </router-link>

              <!-- Operator Dropdown (secured) -->
              <div class="relative h-full flex items-center" @mouseenter="openDropdown = 'operator'" @mouseleave="openDropdown = null">
                <button
                  class="inline-flex items-center gap-1 px-1 pt-1 border-b-2 text-sm font-medium"
                  :class="isOperatorActive ? 'border-primary-500 text-gray-900 dark:text-slate-100' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'"
                >
                  Operator
                  <svg v-if="!isAuthenticated" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-gray-400">
                    <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
                  </svg>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  v-show="openDropdown === 'operator'"
                  class="absolute left-0 top-full w-40 bg-white dark:bg-[#0d1424] rounded-md shadow-lg border border-gray-200 dark:border-[#1a3a5c] z-50"
                >
                  <router-link to="/dashboard" class="dropdown-item" @click="openDropdown = null">
                    <span class="flex items-center gap-2">
                      Dashboard
                      <svg v-if="!isAuthenticated" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-gray-400">
                        <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
                      </svg>
                    </span>
                  </router-link>
                  <router-link to="/tasks" class="dropdown-item" @click="openDropdown = null">
                    <span class="flex items-center gap-2">
                      Tasks
                      <svg v-if="!isAuthenticated" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-gray-400">
                        <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
                      </svg>
                    </span>
                  </router-link>
                  <router-link to="/invoices" class="dropdown-item" @click="openDropdown = null">
                    <span class="flex items-center gap-2">
                      Invoices
                      <svg v-if="!isAuthenticated" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-gray-400">
                        <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
                      </svg>
                    </span>
                  </router-link>
                  <router-link to="/logs" class="dropdown-item" @click="openDropdown = null">
                    <span class="flex items-center gap-2">
                      Logs
                      <svg v-if="!isAuthenticated" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 text-gray-400">
                        <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
                      </svg>
                    </span>
                  </router-link>
                </div>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              @click="toggleTheme"
              class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Toggle theme"
            >
              <span v-if="isDark">🌙</span>
              <span v-else>☀️</span>
              <span>{{ isDark ? 'Dark' : 'Light' }}</span>
            </button>
            <!-- Auth status indicator -->
            <button
              v-if="isAuthenticated"
              @click="handleLogout"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors cursor-pointer"
              title="Click to logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-3 h-3 mr-1.5">
                <path fill-rule="evenodd" d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7A1.5 1.5 0 0 0 3 8.5v5A1.5 1.5 0 0 0 4.5 15h7a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 11.5 7V4.5A3.5 3.5 0 0 0 8 1Zm2 6V4.5a2 2 0 1 0-4 0V7h4Z" clip-rule="evenodd" />
              </svg>
              Authenticated
            </button>
            <!-- Federation connection status -->
            <span
              v-if="federationStore.status.connected"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
            >
              <span class="w-2 h-2 rounded-full mr-1.5 bg-green-500"></span>
              Connected
            </span>
            <span
              v-else-if="federationStore.settings.enabled"
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
            >
              <span class="w-2 h-2 rounded-full mr-1.5 bg-yellow-500 animate-pulse"></span>
              Connecting
            </span>
            <span
              v-else
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
            >
              <span class="w-2 h-2 rounded-full mr-1.5 bg-gray-400"></span>
              Offline
            </span>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
      <router-view />
    </main>
    <AppFooter />
  </div>
</template>

<script setup>
import { onMounted, watch, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Preloader from './components/Preloader.vue';
import AppFooter from './components/AppFooter.vue';
import { usePreloader } from './composables/usePreloader';
import { useRealtime } from './composables/useRealtime';
import { useFederationStore } from './stores/federation';
import { isAuthenticated, authChecked } from './router';

const route = useRoute();
const router = useRouter();
const { setProgress, checkStoredAuth } = usePreloader();
const federationStore = useFederationStore();
const realtime = useRealtime();
const isDark = ref(false);
const openDropdown = ref(null);

// Check if Analytics dropdown items are active
const isAnalyticsActive = computed(() => {
  const analyticsRoutes = ['contracts', 'token', 'nodes', 'staking'];
  return analyticsRoutes.includes(route.name);
});

// Check if Operator dropdown items are active
const isOperatorActive = computed(() => {
  const operatorRoutes = ['dashboard', 'tasks', 'task-detail', 'invoices', 'logs'];
  return operatorRoutes.includes(route.name);
});

// Handle logout
const handleLogout = () => {
  // Clear auth storage
  localStorage.removeItem('app_authenticated');
  localStorage.removeItem('app_password');
  // Update shared auth state
  isAuthenticated.value = false;
  realtime.disconnect();
  // Redirect to home if on a protected route
  if (route.meta.requiresAuth) {
    router.push('/');
  }
};

onMounted(async () => {
  const storedTheme = localStorage.getItem('theme');
  // Default to dark mode if no preference is stored
  isDark.value = storedTheme !== 'light';
  document.documentElement.classList.toggle('dark', isDark.value);

  setProgress(10);

  // Check if user was already authenticated and verify the password
  const wasAuth = await checkStoredAuth();
  isAuthenticated.value = wasAuth;
  authChecked.value = true;
  if (wasAuth) {
    realtime.init();
    realtime.connect();
    realtime.reauth();
  } else {
    realtime.disconnect();
  }
  setProgress(50);

  // Initialize federation for public network stats
  await federationStore.initialize();
  setProgress(100);
});

watch(isAuthenticated, (value) => {
  if (value) {
    realtime.init();
    realtime.connect();
    realtime.reauth();
  } else {
    realtime.disconnect();
  }
});

const toggleTheme = () => {
  isDark.value = !isDark.value;
  document.documentElement.classList.toggle('dark', isDark.value);
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
};
</script>

<style scoped>
.dropdown-item {
  display: block;
  width: 100%;
  padding: 0.5rem 1rem;
  text-align: left;
  font-size: 0.875rem;
  color: #6b7280;
  text-decoration: none;
  transition: background-color 0.15s, color 0.15s;
}

.dropdown-item:hover {
  background-color: #f3f4f6;
  color: #111827;
}

:deep(.dark) .dropdown-item {
  color: #94a3b8;
}

:deep(.dark) .dropdown-item:hover {
  background-color: #1a2744;
  color: #f1f5f9;
}

.dropdown-item:first-child {
  border-radius: 0.375rem 0.375rem 0 0;
}

.dropdown-item:last-child {
  border-radius: 0 0 0.375rem 0.375rem;
}
</style>
