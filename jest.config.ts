import { getJestProjectsAsync } from '@nx/jest';

console.log('jest.config.ts');
console.log('getJestProjectsAsync', await getJestProjectsAsync());

export default async () => ({
  projects: await getJestProjectsAsync(),
});
