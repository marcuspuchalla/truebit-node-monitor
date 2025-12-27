<template>
  <div ref="wrapper" class="globe-wrap">
    <canvas
      ref="canvasRef"
      class="globe-canvas"
      :width="canvasSize * 2"
      :height="canvasSize * 2"
      :style="{ width: canvasSize + 'px', height: canvasSize + 'px', cursor: isDragging ? 'grabbing' : 'grab' }"
      @mousedown="onPointerDown"
      @mousemove="onPointerMove"
      @mouseup="onPointerUp"
      @mouseleave="onPointerUp"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
      @touchend="onPointerUp"
    />
    <div v-if="totalNodes > 0" class="node-count">
      {{ markerCount }} location(s) · {{ totalNodes }} node(s)
    </div>
    <div v-else class="node-count">
      Waiting for node data...
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import createGlobe from 'cobe';

const props = defineProps({
  distribution: {
    type: Object,
    default: () => ({})
  }
});

const wrapper = ref(null);
const canvasRef = ref(null);
const canvasSize = 400;

let globe = null;
let phi = 0;
let theta = 0.3;

// Drag interaction state
const isDragging = ref(false);
let pointerX = 0;
let pointerY = 0;
let dragVelocity = 0;

const continentMap = {
  NA: { label: 'North America', lat: 40, lon: -100 },
  SA: { label: 'South America', lat: -15, lon: -60 },
  EU: { label: 'Europe', lat: 54, lon: 15 },
  AF: { label: 'Africa', lat: 5, lon: 20 },
  AS: { label: 'Asia', lat: 30, lon: 100 },
  OC: { label: 'Oceania', lat: -25, lon: 135 },
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
    label: `${lat.toFixed(1)}, ${lon.toFixed(1)}`,
    lat,
    lon
  };
}

const markers = computed(() => {
  const entries = Object.entries(props.distribution || {});
  return entries
    .map(([key, value]) => {
      const parsed = parseLocationKey(key);
      if (!parsed) return null;
      const count = Number(value) || 0;
      if (count <= 0) return null;
      return {
        location: [parsed.lat, parsed.lon],
        size: Math.min(0.05 + count * 0.02, 0.15)
      };
    })
    .filter(Boolean);
});

const markerCount = computed(() => markers.value.length);

const totalNodes = computed(() => {
  return Object.values(props.distribution || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
});

// Pointer event handlers for drag interaction
function onPointerDown(e) {
  isDragging.value = true;
  pointerX = e.clientX;
  pointerY = e.clientY;
  dragVelocity = 0;
}

function onPointerMove(e) {
  if (!isDragging.value) return;

  const deltaX = e.clientX - pointerX;
  const deltaY = e.clientY - pointerY;

  // Update phi (horizontal rotation) based on drag
  phi += deltaX * 0.005;
  // Update theta (vertical tilt) based on drag, clamped
  theta = Math.max(-0.5, Math.min(0.5, theta + deltaY * 0.003));

  // Store velocity for momentum
  dragVelocity = deltaX * 0.005;

  pointerX = e.clientX;
  pointerY = e.clientY;
}

function onPointerUp() {
  isDragging.value = false;
}

// Touch event handlers
function onTouchStart(e) {
  if (e.touches.length === 1) {
    isDragging.value = true;
    pointerX = e.touches[0].clientX;
    pointerY = e.touches[0].clientY;
    dragVelocity = 0;
  }
}

function onTouchMove(e) {
  if (!isDragging.value || e.touches.length !== 1) return;

  const deltaX = e.touches[0].clientX - pointerX;
  const deltaY = e.touches[0].clientY - pointerY;

  phi += deltaX * 0.005;
  theta = Math.max(-0.5, Math.min(0.5, theta + deltaY * 0.003));
  dragVelocity = deltaX * 0.005;

  pointerX = e.touches[0].clientX;
  pointerY = e.touches[0].clientY;
}

function initGlobe() {
  if (!canvasRef.value) return;

  // Destroy existing globe if any
  if (globe) {
    globe.destroy();
    globe = null;
  }

  try {
    globe = createGlobe(canvasRef.value, {
      devicePixelRatio: 2,
      width: canvasSize * 2,
      height: canvasSize * 2,
      phi: 0,
      theta: 0.3,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0.1, 0.8, 1],
      glowColor: [0.1, 0.5, 0.8],
      markers: markers.value,
      onRender: (state) => {
        state.phi = phi;
        state.theta = theta;

        if (!isDragging.value) {
          // Auto-rotate when not dragging
          // Apply momentum decay from drag
          if (Math.abs(dragVelocity) > 0.0001) {
            phi += dragVelocity;
            dragVelocity *= 0.95; // Decay momentum
          } else {
            // Default slow rotation
            phi += 0.003;
          }
        }
      }
    });
  } catch (error) {
    console.error('Failed to initialize COBE globe:', error);
  }
}

// Watch for marker changes and reinitialize
watch(markers, () => {
  if (globe) {
    initGlobe();
  }
}, { deep: true });

onMounted(() => {
  initGlobe();
});

onUnmounted(() => {
  if (globe) {
    globe.destroy();
    globe = null;
  }
});
</script>

<style scoped>
.globe-wrap {
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 1.5rem;
  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%);
  border-radius: 1rem;
}

.globe-canvas {
  max-width: 100%;
  height: auto;
  aspect-ratio: 1;
  touch-action: none; /* Prevent default touch behaviors */
}

.node-count {
  text-align: center;
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: rgba(100, 200, 255, 0.7);
}
</style>
