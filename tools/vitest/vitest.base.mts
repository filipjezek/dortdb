/// <reference types='vitest' />
import { UserWorkspaceConfig } from 'vitest/config';
import { join } from 'node:path';

const dirname = __dirname;

export function getBaseVitestConfig(
  name: string,
  displayName?: string,
): UserWorkspaceConfig {
  displayName ??= name.split('/').pop();
  return {
    cacheDir: join(dirname, '../../../../node_modules/.vite', name),
    plugins: [],
    test: {
      globals: true,
      name: displayName,
      include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      setupFiles: ['src/test-setup.ts'],
    },
  };
}
