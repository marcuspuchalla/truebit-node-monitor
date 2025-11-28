<template>
  <transition name="fade-out">
    <div v-if="showPreloader" class="preloader">
      <div class="preloader-card">
        <div class="preloader-content">
          <div class="logo-container">
            <svg class="logo" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="4" opacity="0.2"/>
              <circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="4"
                stroke-dasharray="176" stroke-dashoffset="44" class="spinner"/>
            </svg>
          </div>

          <div class="text-content">
            <h1 class="title">TrueBit Monitor</h1>
            <p class="subtitle">Loading application...</p>
          </div>

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
  background: #f9fafb;
  z-index: 9999;
}

.preloader-card {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  padding: 2rem;
  min-width: 300px;
  max-width: 400px;
}

.preloader-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.logo-container {
  width: 64px;
  height: 64px;
  color: #3b82f6;
}

.logo {
  width: 100%;
  height: 100%;
}

.spinner {
  animation: spin 1s linear infinite;
  transform-origin: center;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.text-content {
  text-align: center;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
}

.subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.25rem 0 0;
}

.progress-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  font-weight: 600;
  color: #3b82f6;
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
