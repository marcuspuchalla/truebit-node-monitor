<template>
  <transition name="fade-out">
    <div v-if="showPreloader" class="preloader">
      <div class="preloader-card">
        <div class="preloader-content">
          <div class="logo-container">
            <img src="/logo.png" alt="TruBit Watch" class="logo-image" />
          </div>

          <div class="text-content">
            <h1 class="title">TrueBit Node Monitor</h1>
            <p class="subtitle">Loading network data...</p>
          </div>

          <!-- Loading progress bar -->
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <span class="progress-text">{{ Math.round(progress) }}%</span>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { usePreloader } from '../composables/usePreloader'

const { showPreloader, progress } = usePreloader()
</script>

<style scoped>
.preloader {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #050810;
  z-index: 9999;
}

/* Scanline overlay effect */
.preloader::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.15) 2px,
    rgba(0, 0, 0, 0.15) 4px
  );
  pointer-events: none;
  z-index: 1;
}

.preloader-card {
  background: linear-gradient(135deg, #0a0f1a 0%, #0d1424 100%);
  border-radius: 1rem;
  border: 1px solid #1a3a5c;
  box-shadow:
    0 0 30px rgba(0, 212, 255, 0.1),
    inset 0 1px 0 rgba(0, 212, 255, 0.1);
  padding: 2.5rem;
  min-width: 320px;
  max-width: 420px;
  position: relative;
  z-index: 2;
}

.preloader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.logo-container {
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

/* Glow ring around logo */
.logo-container::before {
  content: '';
  position: absolute;
  inset: -10px;
  border-radius: 50%;
  border: 2px solid rgba(0, 212, 255, 0.3);
  animation: ring-pulse 2s ease-in-out infinite;
}

@keyframes ring-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.5;
    box-shadow: 0 0 10px rgba(0, 212, 255, 0.2);
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
    box-shadow: 0 0 25px rgba(0, 212, 255, 0.4);
  }
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.3));
  animation: logo-glow 2s ease-in-out infinite;
}

@keyframes logo-glow {
  0%, 100% {
    filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.3));
  }
  50% {
    filter: drop-shadow(0 0 20px rgba(0, 212, 255, 0.5));
  }
}

.text-content {
  text-align: center;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #00d4ff;
  margin: 0;
  text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  letter-spacing: 0.05em;
}

.subtitle {
  font-size: 0.875rem;
  color: #4a6fa5;
  margin: 0.5rem 0 0;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}

.progress-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #0d1424;
  border-radius: 2px;
  overflow: hidden;
  border: 1px solid #1a3a5c;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #00d4ff, #00ff88);
  border-radius: 2px;
  transition: width 0.3s ease;
  box-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
  position: relative;
}

/* Animated shine effect on progress bar */
.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  animation: shine 1.5s ease-in-out infinite;
}

@keyframes shine {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-text {
  font-size: 0.75rem;
  font-weight: 600;
  color: #00d4ff;
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  text-shadow: 0 0 5px rgba(0, 212, 255, 0.3);
}

/* Fade out transition */
.fade-out-enter-active,
.fade-out-leave-active {
  transition: opacity 0.5s ease;
}

.fade-out-enter-from,
.fade-out-leave-to {
  opacity: 0;
}
</style>
