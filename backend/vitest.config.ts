import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/services/**/*.ts', 'src/middlewares/**/*.ts', 'src/controllers/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { statements: 60, branches: 60, functions: 60, lines: 60 },
    },
  },
});