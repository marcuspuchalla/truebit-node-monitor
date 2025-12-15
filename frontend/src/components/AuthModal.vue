<template>
  <transition name="fade">
    <div v-if="show" class="auth-overlay">
      <div class="auth-modal">
        <div class="auth-content">
          <div class="lock-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12">
              <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z" clip-rule="evenodd" />
            </svg>
          </div>

          <h2 class="title">Authentication Required</h2>
          <p class="subtitle">Enter your node password to access {{ pageName }}</p>

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
            <code>docker logs truebit-node-monitor | grep "key"</code>
          </p>

          <button class="back-link" @click="goBack">
            Back to Network Overview
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { usePreloader } from '../composables/usePreloader';

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'authenticated'): void;
}>();

const router = useRouter();
const route = useRoute();
const { authenticate, authError } = usePreloader();

const password = ref('');
const isSubmitting = ref(false);
const passwordInput = ref<HTMLInputElement | null>(null);

const pageName = computed(() => {
  return route.meta.title || 'this page';
});

// Focus password input when modal opens
watch(() => props.show, async (show) => {
  if (show) {
    await nextTick();
    passwordInput.value?.focus();
  }
});

onMounted(async () => {
  if (props.show) {
    await nextTick();
    passwordInput.value?.focus();
  }
});

async function handleSubmit() {
  if (!password.value || isSubmitting.value) return;

  isSubmitting.value = true;
  const success = await authenticate(password.value);
  isSubmitting.value = false;

  if (success) {
    emit('authenticated');
  }
}

function goBack() {
  router.push('/');
}
</script>

<style scoped>
.auth-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.auth-modal {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  padding: 2rem;
  max-width: 400px;
  width: 100%;
}

.auth-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.lock-icon {
  color: #3b82f6;
  margin-bottom: 0.5rem;
}

.lock-icon svg {
  width: 48px;
  height: 48px;
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0;
  text-align: center;
}

.subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
  text-align: center;
}

.auth-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
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

.back-link {
  background: none;
  border: none;
  color: #6b7280;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.5rem;
  margin-top: 0.5rem;
  text-decoration: underline;
  transition: color 0.2s;
}

.back-link:hover {
  color: #3b82f6;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
