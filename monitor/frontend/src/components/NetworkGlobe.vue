<template>
  <div ref="wrapper" class="globe-wrap">
    <canvas ref="canvas" class="globe-canvas"></canvas>
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
const canvas = ref(null);
let ctx = null;
let rafId = 0;
let width = 0;
let height = 0;
let radius = 0;
let rotation = 0;

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

function resizeCanvas() {
  if (!wrapper.value || !canvas.value) return;
  const rect = wrapper.value.getBoundingClientRect();
  width = Math.max(280, rect.width);
  height = Math.max(280, rect.width * 0.6);
  const dpr = window.devicePixelRatio || 1;
  canvas.value.width = width * dpr;
  canvas.value.height = height * dpr;
  canvas.value.style.width = `${width}px`;
  canvas.value.style.height = `${height}px`;
  ctx = canvas.value.getContext('2d');
  ctx.scale(dpr, dpr);
  radius = Math.min(width, height) * 0.35;
}

function getColor(name, fallback) {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function latLonToXYZ(lat, lon) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = Math.sin(phi) * Math.cos(theta);
  const y = Math.cos(phi);
  const z = Math.sin(phi) * Math.sin(theta);
  return { x, y, z };
}

function projectPoint(point) {
  const { x, y, z } = latLonToXYZ(point.lat, point.lon);
  const cosR = Math.cos(rotation);
  const sinR = Math.sin(rotation);
  const xR = x * cosR - z * sinR;
  const zR = x * sinR + z * cosR;
  const scale = (zR + 1.3) / 2.3;
  return {
    x: width / 2 + xR * radius,
    y: height / 2 + y * radius,
    scale,
    z: zR
  };
}

function drawSphere() {
  const bg = getColor('--surface', '#ffffff');
  const border = getColor('--border', '#e2e8f0');
  const glow = getColor('--info-border', '#3b82f6');
  const grad = ctx.createRadialGradient(width / 2 - radius * 0.3, height / 2 - radius * 0.3, radius * 0.3, width / 2, height / 2, radius);
  grad.addColorStop(0, bg);
  grad.addColorStop(1, border);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = glow;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawGrid() {
  const grid = getColor('--border', '#e2e8f0');
  ctx.strokeStyle = grid;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 0.5;
  for (let i = -60; i <= 60; i += 30) {
    ctx.beginPath();
    const y = height / 2 + (i / 90) * radius;
    const r = Math.cos((i * Math.PI) / 180) * radius;
    ctx.ellipse(width / 2, y, r, r * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPoints(time) {
  const pulseColor = getColor('--info-border', '#3b82f6');
  const pointColor = getColor('--text', '#0f172a');

  points.value.forEach((point) => {
    const projected = projectPoint(point);
    if (projected.z < -0.2) return;
    const baseSize = 3 + Math.min(point.count, 8);

    // Pulsing rings
    for (let i = 0; i < 3; i += 1) {
      const phase = (time / 1000 + i * 0.6 + point.count * 0.05) % 1;
      const ringSize = baseSize + phase * 20 * projected.scale;
      ctx.strokeStyle = pulseColor;
      ctx.globalAlpha = (1 - phase) * 0.35;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(projected.x, projected.y, ringSize, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Point
    ctx.fillStyle = pointColor;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(projected.x, projected.y, baseSize * projected.scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function render(time) {
  if (!ctx) return;
  ctx.clearRect(0, 0, width, height);
  drawSphere();
  drawGrid();
  drawPoints(time);
  rotation += 0.0025;
  rafId = requestAnimationFrame(render);
}

onMounted(() => {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  rafId = requestAnimationFrame(render);
});

onUnmounted(() => {
  window.removeEventListener('resize', resizeCanvas);
  cancelAnimationFrame(rafId);
});

watch(() => props.distribution, () => {
  // triggers recompute for points
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
}
</style>
