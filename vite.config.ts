import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves a project site from /<repository>/. The deploy workflow
 * sets BASE_PATH; locally the app is served from the root.
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
