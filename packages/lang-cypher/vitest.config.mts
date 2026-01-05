/// <reference types='vitest' />
import { mergeConfig, UserWorkspaceConfig } from 'vitest/config';
import { configServerTests } from '../../tools/vitest/vitest.server.mjs';

export default mergeConfig(configServerTests('lang-cypher'), {
  root: __dirname,
} satisfies UserWorkspaceConfig);
