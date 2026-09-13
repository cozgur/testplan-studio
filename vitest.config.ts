import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Domain logic runs in Node; component tests opt into jsdom per file with
// `// @vitest-environment jsdom`. Playwright owns tests/e2e.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/github/**', 'src/llm/**'],
      exclude: ['src/llm/anthropic-client.ts'],
      reporter: ['text', 'lcov'],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
});
