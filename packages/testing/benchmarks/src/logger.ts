import { pino, transport } from 'pino';
import { resolve } from 'node:path';
import { BenchmarkArgs, parseArgs } from './parse-args.js';

export const LOG_DIR = resolve(import.meta.dirname, '../dist/logs');

const LOG_FILENAME = (args: BenchmarkArgs) => {
  const dbs = args.database.join('-');
  const queries = args.query.join('-');
  return `${args.benchmark}_${dbs}_${queries}.log`;
};

export const logger = pino(
  transport({
    targets: [
      {
        target: 'pino/file',
        options: {
          destination: resolve(LOG_DIR, LOG_FILENAME(parseArgs())),
          mkdir: true,
        },
      },
      {
        target: 'pino-pretty',
      },
    ],
  }),
);
