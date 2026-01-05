/// <reference types='vitest' />
import { mergeConfig, UserWorkspaceConfig } from 'vitest/config';
import { configServerTests } from '../../../tools/vitest/vitest.server.mjs';

const config = mergeConfig(configServerTests('testing/benchmarks'), {
  root: __dirname,
} satisfies UserWorkspaceConfig);
config['test'].passWithNoTests = true; // nx test fails without this

export default config;
