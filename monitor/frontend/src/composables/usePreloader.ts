import { ref } from 'vue';

// Auth state - shared across all components
const isAuthenticated = ref(false);
const authError = ref('');
const sessionToken = ref<string | null>(null);

// Loading state for initial app load
const showPreloader = ref(true);
const progress = ref(0);
const loadingComplete = ref(false);

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
    if (j >> 8) return ''; // ASCII check
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

const hidePreloader = (): void => {
  showPreloader.value = false;
};

const setProgress = (value: number): void => {
  progress.value = Math.min(100, Math.max(0, value));
  if (progress.value >= 100) {
    loadingComplete.value = true;
    // Auto-hide preloader after loading - no auth required for public pages
    setTimeout(() => hidePreloader(), 300);
  }
};

const incrementProgress = (amount = 10): void => {
  setProgress(progress.value + amount);
};

const authenticate = async (password: string): Promise<boolean> => {
  authError.value = '';

  try {
    // Step 1: Get challenge from server
    const challengeResponse = await fetch('/api/auth/challenge');
    if (!challengeResponse.ok) {
      throw new Error('Failed to get authentication challenge');
    }
    const { challengeId, challenge } = await challengeResponse.json();

    // Step 2: Hash password with challenge (password never sent over network)
    const hash = await hashWithChallenge(challenge, password);

    // Step 3: Send hash to server for verification
    const verifyResponse = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, hash })
    });

    const data = await verifyResponse.json();

    if (verifyResponse.ok && data.success) {
      isAuthenticated.value = true;
      // Store session token (not password!) in memory and localStorage
      // Session tokens are secure: they're random, expire, and don't reveal the password
      sessionToken.value = data.sessionToken;
      localStorage.setItem('app_authenticated', 'true');
      localStorage.setItem('app_session_token', data.sessionToken);
      // Remove any old password storage (migration)
      localStorage.removeItem('app_password');
      return true;
    } else {
      authError.value = 'Invalid password';
      return false;
    }
  } catch (error) {
    authError.value = 'Connection error. Please try again.';
    return false;
  }
};

// Check if already authenticated (from localStorage)
const checkStoredAuth = async (): Promise<boolean> => {
  const wasAuthenticated = localStorage.getItem('app_authenticated');
  const storedToken = localStorage.getItem('app_session_token');

  // Migration: clear old password storage if present
  if (localStorage.getItem('app_password')) {
    localStorage.removeItem('app_password');
  }

  if (wasAuthenticated === 'true' && storedToken) {
    // Verify the session token is still valid by making a test API call
    try {
      const response = await fetch('/api/tasks/auth/status', {
        headers: { 'X-Session-Token': storedToken }
      });

      if (!response.ok) {
        localStorage.removeItem('app_authenticated');
        localStorage.removeItem('app_session_token');
        sessionToken.value = null;
        isAuthenticated.value = false;
        return false;
      }

      const data = await response.json() as { authenticated?: boolean };
      if (data.authenticated) {
        isAuthenticated.value = true;
        sessionToken.value = storedToken;
        return true;
      }

      // Session token no longer valid, clear storage
      localStorage.removeItem('app_authenticated');
      localStorage.removeItem('app_session_token');
      sessionToken.value = null;
      isAuthenticated.value = false;
      return false;
    } catch {
      return false;
    }
  }
  return false;
};

// Logout - clear stored auth
const logout = (): void => {
  isAuthenticated.value = false;
  sessionToken.value = null;
  localStorage.removeItem('app_authenticated');
  localStorage.removeItem('app_session_token');
  // Migration cleanup
  localStorage.removeItem('app_password');
};

// Get session token (for API calls that need authentication)
const getSessionToken = (): string | null => {
  return sessionToken.value || localStorage.getItem('app_session_token');
};

// Deprecated: kept for backwards compatibility during transition
const getStoredPassword = (): string | null => {
  // Return session token instead - API now accepts both
  return getSessionToken();
};

export const usePreloader = () => {
  return {
    showPreloader,
    progress,
    loadingComplete,
    isAuthenticated,
    authError,
    hidePreloader,
    setProgress,
    incrementProgress,
    authenticate,
    checkStoredAuth,
    logout,
    getSessionToken,
    getStoredPassword // Deprecated, use getSessionToken
  };
};
