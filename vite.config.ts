import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // Use the browser-compatible npm package instead of the Node built-in
      buffer: 'buffer/',
    },
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['buffer'],
  },
});
