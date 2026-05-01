import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    // Default to node. .test.tsx files opt into jsdom via the
    // `/** @vitest-environment jsdom */` directive at the top of each file.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globalSetup: ['src/test/llmock-setup.ts'],
    setupFiles: ['src/test/setup.ts', 'src/test/setup-dom.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts'],
      exclude: ['src/test/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  // tsconfig uses jsx: 'preserve' for Next.js. Vitest's esbuild needs the
  // automatic transform so React doesn't have to be imported explicitly.
  esbuild: {
    jsx: 'automatic',
  },
});
