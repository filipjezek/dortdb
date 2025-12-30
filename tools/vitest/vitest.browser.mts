/// <reference types='vitest' />
import { mergeConfig, UserWorkspaceConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import { playwright } from '@vitest/browser-playwright';
import { getBaseVitestConfig } from './vitest.base.mjs';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

export function configBrowserTests(
  name: string,
  displayName?: string,
): UserWorkspaceConfig {
  return mergeConfig(getBaseVitestConfig(name, displayName), {
    plugins: [angular(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
    test: {
      browser: {
        enabled: true,
        provider: playwright(),
        headless: !process.env['SHOW_BROWSER'],
        screenshotFailures: false,
        instances: [{ browser: 'chromium' }],
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          silenceDeprecations: ['if-function'],
        },
      },
    },
  } satisfies UserWorkspaceConfig);
}
