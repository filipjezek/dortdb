import { Fn } from '@dortdb/core';

/**
 * XQuery functions receive this as the last argument (for better compatibility with extensions for other languages)
 */
export interface FnContext {
  /** The context item (`.` / `fs:dot`) for the current iteration step. */
  item: unknown;
  /** 1-based position of the context item within the current sequence. */
  position: number;
  /** Total number of items in the current sequence (the value returned by `fn:last()`). */
  size: number;
}

/** XQuery `fn:position()` - returns the 1-based position of the context item. */
export const position: Fn = {
  name: 'position',
  impl: (curr: unknown, context: FnContext) => context.position,
};

/** XQuery `fn:last()` - returns the total number of items in the sequence. */
export const last: Fn = {
  name: 'last',
  impl: (curr: unknown, context: FnContext) => context.size,
};
