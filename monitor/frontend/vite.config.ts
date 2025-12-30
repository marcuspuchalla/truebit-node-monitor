import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      // Token API proxied to standalone token server (runs without Docker)
      '/api/token': {
        target: 'http://localhost:8091',
        changeOrigin: true
      },
      // Other API calls go to main backend
      '/api': {
        target: 'http://localhost:8090',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8090',
        ws: true
      }
    }
  }
});
