import { ref } from 'vue';

const showPreloader = ref(true);
const progress = ref(0);
const loadingComplete = ref(false);
const isAuthenticated = ref(false);
const authError = ref('');

const hidePreloader = (): void => {
  showPreloader.value = false;
};

const setProgress = (value: number): void => {
  progress.value = Math.min(100, Math.max(0, value));
  if (progress.value >= 100) {
    // Mark loading as complete but don't hide preloader yet - wait for auth
    loadingComplete.value = true;
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
      // Store in session so user doesn't need to re-enter on page refresh
      sessionStorage.setItem('app_authenticated', 'true');
      sessionStorage.setItem('app_password', password);
      // Now hide the preloader
      setTimeout(() => hidePreloader(), 300);
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

// Check if already authenticated in this session
const checkSessionAuth = async (): Promise<boolean> => {
  const wasAuthenticated = sessionStorage.getItem('app_authenticated');
  const storedPassword = sessionStorage.getItem('app_password');

  if (wasAuthenticated === 'true' && storedPassword) {
    // Verify the password is still valid
    const valid = await authenticate(storedPassword);
    return valid;
  }
  return false;
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
    checkSessionAuth
  };
};
