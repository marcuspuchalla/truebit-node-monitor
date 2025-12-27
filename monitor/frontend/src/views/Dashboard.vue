<template>
  <div class="space-y-6">
    <!-- Warning Banner -->
    <div class="warning-banner">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-yellow-400 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <p class="text-sm text-yellow-800 dark:text-amber-300">
            <strong>Unofficial Monitor</strong> - This tool is not affiliated with TrueBit. Use at your own risk.
            <router-link to="/about" class="font-semibold underline hover:text-yellow-900 dark:hover:text-amber-200">Read the full disclaimer →</router-link>
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
    <div class="card p-4">
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

    <!-- Location Sharing -->
    <div class="card p-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="text-sm font-medium text-gray-900 dark:text-slate-100">Location Sharing</h3>
          <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Share an approximate location (nearest city) with the network. Disable to stay private.
          </p>
        </div>
        <label class="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
          <input type="checkbox" v-model="locationEnabled" />
          Enabled
        </label>
      </div>

      <div class="mt-4">
        <div class="flex flex-col md:flex-row gap-2">
          <input
            v-model="locationQuery"
            type="text"
            placeholder="City or country (via OpenStreetMap)"
            class="flex-1 border border-gray-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded px-2 py-1 text-xs"
            :disabled="!locationEnabled"
          />
          <button
            @click="lookupLocation"
            class="px-3 py-1 text-xs font-medium rounded border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
            :disabled="!locationEnabled || isLookingUp"
          >
            {{ isLookingUp ? 'Looking up...' : 'Find location' }}
          </button>
        </div>
        <p v-if="lookupError" class="mt-2 text-[11px] text-red-600">
          {{ lookupError }}
        </p>
        <p v-else class="mt-2 text-[11px] text-gray-500 dark:text-slate-400">
          Location lookup powered by OpenStreetMap Nominatim.
        </p>
      </div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label class="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300">
          <input type="checkbox" v-model="useCustomLocation" :disabled="!locationEnabled" />
          Use custom location
        </label>
        <input
          v-model="locationLabel"
          type="text"
          placeholder="City label (optional)"
          class="border border-gray-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded px-2 py-1 text-xs"
          :disabled="!locationEnabled || !useCustomLocation"
        />
        <input
          v-model.number="locationLat"
          type="number"
          step="0.1"
          min="-90"
          max="90"
          placeholder="Latitude"
          class="border border-gray-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded px-2 py-1 text-xs"
          :disabled="!locationEnabled || !useCustomLocation"
        />
        <input
          v-model.number="locationLon"
          type="number"
          step="0.1"
          min="-180"
          max="180"
          placeholder="Longitude"
          class="border border-gray-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 rounded px-2 py-1 text-xs"
          :disabled="!locationEnabled || !useCustomLocation"
        />
      </div>

      <div class="mt-3 flex items-center justify-between">
        <p class="text-[11px] text-gray-500 dark:text-slate-400">
          Custom coordinates override IP-based lookup. Rounded to city-level buckets before sharing.
        </p>
        <button
          @click="saveLocationSettings"
          class="px-3 py-1 text-xs font-medium rounded border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800"
          :disabled="isSavingLocation"
        >
          {{ isSavingLocation ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import NodeStatus from '../components/NodeStatus.vue';
import TaskSummary from '../components/TaskSummary.vue';
import TaskTable from '../components/TaskTable.vue';
import LogViewer from '../components/LogViewer.vue';
import InvoiceSummary from '../components/InvoiceSummary.vue';
import { useTasksStore } from '../stores/tasks';
import { useFederationStore } from '../stores/federation';
import { federationAPI } from '../services/api';

const tasksStore = useTasksStore();
const federationStore = useFederationStore();

const { settings: federationSettings } = storeToRefs(federationStore);
const isToggling = ref(false);
const locationEnabled = ref(true);
const useCustomLocation = ref(false);
const locationQuery = ref('');
const locationLabel = ref('');
const locationLat = ref(null);
const locationLon = ref(null);
const isSavingLocation = ref(false);
const isLookingUp = ref(false);
const lookupError = ref('');

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

function syncLocationFromSettings() {
  const settings = federationSettings.value;
  if (!settings) return;
  locationEnabled.value = settings.locationEnabled !== false;
  const hasCoords = typeof settings.locationLat === 'number' && typeof settings.locationLon === 'number';
  useCustomLocation.value = hasCoords;
  locationLabel.value = settings.locationLabel || '';
  locationLat.value = hasCoords ? settings.locationLat : null;
  locationLon.value = hasCoords ? settings.locationLon : null;
}

async function saveLocationSettings() {
  isSavingLocation.value = true;
  try {
    const enabled = locationEnabled.value;
    const useCustom = enabled && useCustomLocation.value;
    const lat = Number.isFinite(locationLat.value) ? locationLat.value : null;
    const lon = Number.isFinite(locationLon.value) ? locationLon.value : null;
    await federationStore.updateSettings({
      locationEnabled: enabled,
      locationLabel: useCustom ? (locationLabel.value || null) : null,
      locationLat: useCustom ? lat : null,
      locationLon: useCustom ? lon : null
    });
  } catch (error) {
    console.error('Location settings update error:', error);
  } finally {
    isSavingLocation.value = false;
  }
}

async function lookupLocation() {
  if (!locationQuery.value || locationQuery.value.trim().length < 2) {
    lookupError.value = 'Enter a city or country.';
    return;
  }

  isLookingUp.value = true;
  lookupError.value = '';

  try {
    const result = await federationAPI.lookupLocation(locationQuery.value.trim());
    useCustomLocation.value = true;
    locationLat.value = result.lat;
    locationLon.value = result.lon;
    if (!locationLabel.value) {
      locationLabel.value = result.label;
    }
  } catch (error) {
    lookupError.value = 'No matches found or lookup failed.';
  } finally {
    isLookingUp.value = false;
  }
}

watch(federationSettings, syncLocationFromSettings, { immediate: true });

onMounted(() => {
  tasksStore.fetchTasks({ limit: 10 });
  federationStore.fetchSettings();
});
</script>

<style scoped>
.warning-banner {
  background: #fef3c7;
  border-left: 4px solid #fbbf24;
  padding: 1rem;
  border-radius: 0.25rem;
}

.dark .warning-banner {
  background: rgba(255, 170, 0, 0.1);
  border-left-color: #ffaa00;
  border: 1px solid rgba(255, 170, 0, 0.3);
  border-left-width: 4px;
}

.federation-toggle {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid #d1d5db;
  background: white;
  color: #374151;
}

.dark .federation-toggle {
  background: #0a0f1a;
  border-color: #1a3a5c;
  color: #00d4ff;
}

.federation-toggle:hover:not(:disabled) {
  background: #f3f4f6;
}

.dark .federation-toggle:hover:not(:disabled) {
  background: #0d1424;
  border-color: #00d4ff;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.3);
}

.federation-toggle.enabled {
  background: #fee2e2;
  border-color: #fca5a5;
  color: #991b1b;
}

.dark .federation-toggle.enabled {
  background: rgba(255, 51, 102, 0.1);
  border-color: #ff3366;
  color: #ff3366;
}

.federation-toggle.enabled:hover:not(:disabled) {
  background: #fecaca;
}

.dark .federation-toggle.enabled:hover:not(:disabled) {
  background: rgba(255, 51, 102, 0.2);
  box-shadow: 0 0 10px rgba(255, 51, 102, 0.3);
}

.federation-toggle:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
