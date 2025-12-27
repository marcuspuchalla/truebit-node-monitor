<template>
  <div ref="wrapper" class="globe-wrap">
    <div v-if="globeError" class="globe-fallback">
      <div class="globe-icon">🌍</div>
      <div class="globe-text">Global node distribution</div>
    </div>
    <div v-show="!globeError" ref="globeEl" class="globe-canvas"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';

const props = defineProps({
  distribution: {
    type: Object,
    default: () => ({})
  }
});

const wrapper = ref(null);
const globeEl = ref(null);
const globeError = ref(false);
let globeInstance = null;
let resizeHandler = null;

// Check WebGL support
function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}

const continentMap = {
  NA: { label: 'North America', lat: 40, lon: -100 },
  SA: { label: 'South America', lat: -15, lon: -60 },
  EU: { label: 'Europe', lat: 54, lon: 15 },
  AF: { label: 'Africa', lat: 5, lon: 20 },
  AS: { label: 'Asia', lat: 30, lon: 100 },
  OC: { label: 'Oceania', lat: -20, lon: 130 },
  AN: { label: 'Antarctica', lat: -75, lon: 0 }
};

function parseLocationKey(key) {
  if (continentMap[key]) {
    return {
      label: continentMap[key].label,
      lat: continentMap[key].lat,
      lon: continentMap[key].lon
    };
  }

  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return {
    label: key,
    lat,
    lon
  };
}

const points = computed(() => {
  const entries = Object.entries(props.distribution || {});
  return entries
    .map(([key, value]) => {
      const parsed = parseLocationKey(key);
      if (!parsed) return null;
      return {
        id: key,
        label: parsed.label,
        lat: parsed.lat,
        lon: parsed.lon,
        count: Number(value) || 0
      };
    })
    .filter(Boolean)
    .filter(p => p.count > 0);
});

function getColor(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function updateGlobeSize() {
  if (!wrapper.value || !globeInstance) return;
  const rect = wrapper.value.getBoundingClientRect();
  const width = Math.max(320, rect.width);
  const height = Math.max(320, rect.width * 0.6);
  globeInstance.width(width);
  globeInstance.height(height);
}

function updateGlobePoints() {
  if (!globeInstance) return;
  const accent = getColor('--info-border', '#3b82f6');
  globeInstance
    .pointsData(points.value)
    .pointLat((d) => d.lat)
    .pointLng((d) => d.lon)
    .pointAltitude((d) => 0.02 + Math.min(d.count, 10) * 0.003)
    .pointRadius((d) => 0.15 + Math.min(d.count, 10) * 0.08)
    .pointColor(() => accent);
}

onMounted(async () => {
  if (!globeEl.value) return;

  // Check WebGL support first
  if (!isWebGLAvailable()) {
    console.warn('WebGL not available, showing fallback');
    globeError.value = true;
    return;
  }

  try {
    // Dynamic import to handle potential bundling issues
    const GlobeModule = await import('globe.gl');
    const Globe = GlobeModule.default;

    globeInstance = Globe()(globeEl.value)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor(getColor('--info-border', '#3b82f6'))
      .atmosphereAltitude(0.15)
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-dark.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png');

    updateGlobeSize();
    updateGlobePoints();
    resizeHandler = () => updateGlobeSize();
    window.addEventListener('resize', resizeHandler);
  } catch (err) {
    console.error('Failed to initialize globe:', err);
    globeError.value = true;
  }
});

onUnmounted(() => {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
  }
  if (globeInstance) {
    globeInstance = null;
  }
});

watch(() => props.distribution, () => {
  updateGlobePoints();
});
</script>

<style scoped>
.globe-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
}

.globe-canvas {
  display: block;
  border-radius: 1rem;
  background: transparent;
  width: 100%;
  min-height: 320px;
}

.globe-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  width: 100%;
  background: var(--surface-muted, #f3f4f6);
  border-radius: 1rem;
}

.globe-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.globe-text {
  color: var(--muted, #6b7280);
  font-size: 0.875rem;
}
</style>
