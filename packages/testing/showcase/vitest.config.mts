/// <reference types='vitest' />
import { mergeConfig, UserWorkspaceConfig } from 'vitest/config';
import { configBrowserTests } from '../../../tools/vitest/vitest.browser.mjs';

const config = mergeConfig(configBrowserTests('testing/showcase'), {
  root: __dirname,
} satisfies UserWorkspaceConfig);
config['test'].reporters = ['default'];
export default config;
