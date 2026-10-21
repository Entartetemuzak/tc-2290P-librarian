import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * GitHub Pages serves a project site from /<repository>/. The deploy workflow
 * sets BASE_PATH; locally the app is served from the root.
 */
const base = process.env.BASE_PATH ?? '/';

/** Shown in the app so you can tell which version a device is running. */
const commit = (process.env.GITHUB_SHA ?? 'local').slice(0, 7);
const builtAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
const buildId = `${commit} · ${builtAt} UTC`;

export default defineConfig({
  base,
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
