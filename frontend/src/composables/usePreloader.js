import { ref } from 'vue'

const showPreloader = ref(true)
const progress = ref(0)

const hidePreloader = () => {
  showPreloader.value = false
}

const setProgress = (value) => {
  progress.value = Math.min(100, Math.max(0, value))
  if (progress.value >= 100) {
    setTimeout(() => hidePreloader(), 300)
  }
}

const incrementProgress = (amount = 10) => {
  setProgress(progress.value + amount)
}

export const usePreloader = () => {
  return {
    showPreloader,
    progress,
    hidePreloader,
    setProgress,
    incrementProgress
  }
}
