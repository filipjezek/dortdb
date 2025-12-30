/// <reference types='vitest' />
import { UserWorkspaceConfig, mergeConfig } from 'vitest/config';
import { getBaseVitestConfig } from './vitest.base.mjs';

export function configServerTests(
  name: string,
  displayName?: string,
): UserWorkspaceConfig {
  return mergeConfig(getBaseVitestConfig(name, displayName), {
    test: {
      environment: 'node',
    },
  } satisfies UserWorkspaceConfig);
}
