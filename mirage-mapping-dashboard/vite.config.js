import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const processorTarget = process.env.MIRAGE_PROCESSOR_PROXY_TARGET || 'http://127.0.0.1:8765';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 4175,
    proxy: {
      '/health': processorTarget,
      '/runs/current': processorTarget,
      '/jobs': processorTarget,
      '/anchors': processorTarget,
      '/poll-once': processorTarget,
      '/dashboard/api/backend': processorTarget,
    },
  },
});
