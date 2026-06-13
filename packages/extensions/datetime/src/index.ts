/**
 * Entry point for the `@dortdb/datetime` extension. Registers date/time
 * support and exports the `Interval` type along with date/time functions such
 * as `now`, `datetime`, `interval`, `dateAdd`, `dateSub`, and `extract`.
 *
 * @packageDocumentation
 */

export * from './lib/extension.js';
export * from './lib/functions.js';
