import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const demo = !!process.env.VITE_DEMO;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:3000', changeOrigin: false } },
  },
  // نسخهٔ نمایشی: همه‌چیز در یک فایل (برای انتشار به‌شکل یک صفحه)
  build: demo ? { outDir: 'dist-demo', assetsInlineLimit: 100_000_000, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } } : {},
});
