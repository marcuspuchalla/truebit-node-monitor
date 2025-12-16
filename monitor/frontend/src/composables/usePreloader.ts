import { ref } from 'vue';

// Auth state - shared across all components
const isAuthenticated = ref(false);
const authError = ref('');

// Loading state for initial app load
const showPreloader = ref(true);
const progress = ref(0);
const loadingComplete = ref(false);

// Hash password with challenge using Web Crypto API
async function hashWithChallenge(challenge: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(challenge + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Challenge-response authentication
async function authenticateWithChallenge(password: string): Promise<boolean> {
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
  return verifyResponse.ok && data.success;
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
    const success = await authenticateWithChallenge(password);

    if (success) {
      isAuthenticated.value = true;
      // Store in localStorage so user doesn't need to re-enter
      // This is "strictly necessary" storage for authentication - no cookie consent needed
      localStorage.setItem('app_authenticated', 'true');
      localStorage.setItem('app_password', password);
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
  const storedPassword = localStorage.getItem('app_password');

  if (wasAuthenticated === 'true' && storedPassword) {
    // Verify the password is still valid using challenge-response
    try {
      const success = await authenticateWithChallenge(storedPassword);

      if (success) {
        isAuthenticated.value = true;
        return true;
      } else {
        // Password no longer valid, clear storage
        localStorage.removeItem('app_authenticated');
        localStorage.removeItem('app_password');
        isAuthenticated.value = false;
        return false;
      }
    } catch {
      return false;
    }
  }
  return false;
};

// Logout - clear stored auth
const logout = (): void => {
  isAuthenticated.value = false;
  localStorage.removeItem('app_authenticated');
  localStorage.removeItem('app_password');
};

// Get stored password (for API calls that need it)
const getStoredPassword = (): string | null => {
  return localStorage.getItem('app_password');
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
    getStoredPassword
  };
};
