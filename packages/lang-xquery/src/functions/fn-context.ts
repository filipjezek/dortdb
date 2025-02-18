import { Fn } from '@dortdb/core';

/**
 * XQuery functions receive this as the last argument (for better compatibility with extensions for other languages)
 */
export interface FnContext {
  item: unknown;
  position: number;
  size: number;
}

export const position: Fn = {
  name: 'position',
  impl: (context: FnContext) => context.position,
};

export const last: Fn = {
  name: 'last',
  impl: (context: FnContext) => context.size,
};
