import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig({
  plugins: [react(), cloudflare({ configPath: './wrangler.worker.jsonc' })],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});