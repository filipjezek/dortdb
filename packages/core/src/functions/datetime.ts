import { Fn } from '../extension.js';

export const now: Fn = {
  name: 'now',
  impl: () => new Date(),
  pure: true,
};
