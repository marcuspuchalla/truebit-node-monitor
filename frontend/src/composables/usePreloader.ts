import { ref } from 'vue';

// Auth state - shared across all components
const isAuthenticated = ref(false);
const authError = ref('');

// Loading state for initial app load
const showPreloader = ref(true);
const progress = ref(0);
const loadingComplete = ref(false);

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
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      isAuthenticated.value = true;
      // Store in localStorage so user doesn't need to re-enter
      // This is "strictly necessary" storage for authentication - no cookie consent needed
      localStorage.setItem('app_authenticated', 'true');
      localStorage.setItem('app_password', password);
      return true;
    } else {
      authError.value = data.message || 'Invalid password';
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
    // Verify the password is still valid
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: storedPassword })
      });

      const data = await response.json();

      if (response.ok && data.success) {
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
