import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'presuerp.duckdns.org',
    ],
    proxy: {
      '/api/v1': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
});