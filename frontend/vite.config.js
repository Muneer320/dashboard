import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load all .env vars for the current mode.
  // Using '' prefix loads *everything*, including non-VITE_ vars like BACKEND_URL.
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = process.env.BACKEND_URL || env.BACKEND_URL || 'http://127.0.0.1:8000';

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        // Proxy /api/v1/* → http://localhost:8000/api/v1/*
        // No rewrite needed — the backend itself uses /api/v1 as its prefix.
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
