/// <reference types='vitest' />
import { mergeConfig, UserWorkspaceConfig } from 'vitest/config';
import { configBrowserTests } from '../../../tools/vitest/vitest.browser.mjs';

export default mergeConfig(configBrowserTests('testing/showcase'), {
  root: __dirname,
} satisfies UserWorkspaceConfig);
