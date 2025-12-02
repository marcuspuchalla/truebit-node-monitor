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
            <p class="subtitle" v-if="!loadingComplete">Loading application...</p>
            <p class="subtitle" v-else>Enter password to continue</p>
          </div>

          <!-- Loading progress bar -->
          <div v-if="!loadingComplete" class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
            <span class="progress-text">{{ Math.round(progress) }}%</span>
          </div>

          <!-- Password form (shown after loading completes) -->
          <div v-else class="auth-container">
            <form @submit.prevent="handleSubmit" class="auth-form">
              <div class="input-group">
                <input
                  ref="passwordInput"
                  v-model="password"
                  type="password"
                  placeholder="Enter your node password"
                  class="password-input"
                  :class="{ 'error': authError }"
                  :disabled="isSubmitting"
                  autocomplete="current-password"
                />
              </div>
              <p v-if="authError" class="error-message">{{ authError }}</p>
              <button
                type="submit"
                class="submit-button"
                :disabled="isSubmitting || !password"
              >
                {{ isSubmitting ? 'Verifying...' : 'Unlock' }}
              </button>
            </form>
            <p class="help-text">
              Find your password in the container logs:<br>
              <code>docker logs truebit-node-monitor | grep "🔑"</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { usePreloader } from '../composables/usePreloader'

const { showPreloader, progress, loadingComplete, authError, authenticate } = usePreloader()

const password = ref('')
const isSubmitting = ref(false)
const passwordInput = ref(null)

// Focus password input when loading completes
watch(loadingComplete, async (complete) => {
  if (complete) {
    await nextTick()
    passwordInput.value?.focus()
  }
})

async function handleSubmit() {
  if (!password.value || isSubmitting.value) return

  isSubmitting.value = true
  await authenticate(password.value)
  isSubmitting.value = false
}
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
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
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

/* Auth form styles */
.auth-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.input-group {
  width: 100%;
}

.password-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.password-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.password-input.error {
  border-color: #ef4444;
}

.password-input:disabled {
  background: #f3f4f6;
  cursor: not-allowed;
}

.error-message {
  color: #ef4444;
  font-size: 0.875rem;
  margin: 0;
  text-align: center;
}

.submit-button {
  width: 100%;
  padding: 0.75rem 1rem;
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.submit-button:hover:not(:disabled) {
  opacity: 0.9;
}

.submit-button:active:not(:disabled) {
  transform: scale(0.98);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.help-text {
  font-size: 0.75rem;
  color: #9ca3af;
  text-align: center;
  margin: 0;
  line-height: 1.5;
}

.help-text code {
  display: block;
  background: #f3f4f6;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
  margin-top: 0.25rem;
  word-break: break-all;
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
