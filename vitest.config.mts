import { join } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    reporters: ['default'],
    projects: ['./packages/**/vitest.config.{mjs,js,ts,mts}'],
    coverage: {
      reportsDirectory: join(__dirname, 'coverage'),
      provider: 'v8' as const,
    },
    passWithNoTests: true,
  },
});
