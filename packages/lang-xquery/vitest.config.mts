/// <reference types='vitest' />
import { mergeConfig, UserWorkspaceConfig } from 'vitest/config';
import { configServerTests } from '../../tools/vitest/vitest.server.mjs';

export default mergeConfig(configServerTests('lang-xquery'), {
  root: __dirname,
  test: {
    environment: 'jsdom',
  },
} satisfies UserWorkspaceConfig);
