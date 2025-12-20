<template>
  <div class="protected-route">
    <!-- Show auth screen if not authenticated -->
    <div v-if="authChecked && !isAuthenticated" class="auth-screen">
      <div class="auth-card">
        <div class="auth-content">
          <div class="lock-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
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

          <router-link to="/" class="back-link">
            Back to Network Overview
          </router-link>
        </div>
      </div>
    </div>

    <!-- Render the actual component when authenticated -->
    <component v-else-if="authChecked" :is="component" v-bind="$attrs" />
    <div v-else class="text-center py-12 text-gray-500">Checking authentication...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, type Component } from 'vue';
import { useRoute } from 'vue-router';
import { isAuthenticated, authChecked } from '../router';

defineProps<{
  component: Component;
}>();

const route = useRoute();

const password = ref('');
const isSubmitting = ref(false);
const authError = ref('');
const passwordInput = ref<HTMLInputElement | null>(null);

const pageName = computed(() => {
  return route.meta.title || 'this page';
});

onMounted(async () => {
  if (!isAuthenticated.value) {
    await nextTick();
    passwordInput.value?.focus();
  }
});

// Pure JavaScript SHA-256 implementation (fallback for HTTP)
function sha256Fallback(message: string): string {
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = message.length * 8;

  let hash = sha256Fallback.h = sha256Fallback.h || [];
  const k = sha256Fallback.k = sha256Fallback.k || [];
  let primeCounter = k.length;

  const isComposite: { [key: number]: boolean } = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) {
        isComposite[i] = true;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  message += '\x80';
  while ((message.length % 64) - 56) message += '\x00';
  for (let i = 0; i < message.length; i++) {
    const j = message.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;

  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    hash = hash.slice(0, 8);

    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash) as number[];
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (let i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}
sha256Fallback.h = [] as number[];
sha256Fallback.k = [] as number[];

// Hash password with challenge - uses Web Crypto API if available, falls back to JS implementation
async function hashWithChallenge(challenge: string, password: string): Promise<string> {
  const message = challenge + password;

  // Try Web Crypto API first (requires HTTPS or localhost)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to JS implementation
    }
  }

  // Fallback to pure JS SHA-256 (works on HTTP)
  return sha256Fallback(message);
}

async function handleSubmit() {
  if (!password.value || isSubmitting.value) return;

  authError.value = '';
  isSubmitting.value = true;

  try {
    // Step 1: Get challenge from server
    const challengeResponse = await fetch('/api/auth/challenge');
    if (!challengeResponse.ok) {
      throw new Error('Failed to get authentication challenge');
    }
    const { challengeId, challenge } = await challengeResponse.json();

    // Step 2: Hash password with challenge (password never sent over network)
    const hash = await hashWithChallenge(challenge, password.value);

    // Step 3: Send hash to server for verification
    const verifyResponse = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, hash })
    });

    const data = await verifyResponse.json();

    if (verifyResponse.ok && data.success) {
      // Store session token (not password!) in localStorage
      // Session tokens are secure: random, expire in 24h, don't reveal password
      localStorage.setItem('app_authenticated', 'true');
      localStorage.setItem('app_session_token', data.sessionToken);
      // Remove any old password storage (migration)
      localStorage.removeItem('app_password');
      // Update the shared auth state
      isAuthenticated.value = true;
    } else {
      authError.value = data.message || 'Invalid password';
    }
  } catch (error) {
    authError.value = 'Connection error. Please try again.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.protected-route {
  min-height: calc(100vh - 200px);
}

.auth-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 200px);
  padding: 2rem;
}

.auth-card {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
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
  color: #6b7280;
  font-size: 0.875rem;
  padding: 0.5rem;
  margin-top: 0.5rem;
  text-decoration: underline;
  transition: color 0.2s;
}

.back-link:hover {
  color: #3b82f6;
}
</style>
