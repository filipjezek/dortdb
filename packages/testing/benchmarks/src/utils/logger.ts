import { Logger, pino, transport } from 'pino';
import { resolve } from 'node:path';
import type { BenchmarkArgs } from '../parse-args.js';

const LOG_DIR = resolve(import.meta.dirname, '../../dist/logs');

let loggerInstance: Logger;

export function logger() {
  if (!loggerInstance)
    throw new Error('Logger not initialized. Call `setupLogger()` before using the logger.');

  return loggerInstance;
}

export function setupLogger(args: BenchmarkArgs) {
  loggerInstance = createLogger(args);
}

function createLogger(args: BenchmarkArgs) {
  return pino(
    transport({
      targets: [ {
        target: 'pino/file',
        options: {
          destination: resolve(LOG_DIR, getLogFilename(args)),
          mkdir: true,
        },
      }, {
          target: 'pino-pretty',
      } ],
    }),
  );
}

function getLogFilename(args: BenchmarkArgs) {
  if (args.output)
    return args.output;

  const dbs = args.database.join('-');
  const queries = args.query.join('-');
  return `${args.benchmark}_${dbs}_${queries}.log`;
}
