import { pdfAssets } from './pdf-assets';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({ mode }) => ({ plugins: [react(),pdfAssets()], server: { proxy: { '/api': loadEnv(mode, process.cwd(), '').API_PROXY_TARGET || 'http://localhost:3001' } }, test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], css: false } }));
