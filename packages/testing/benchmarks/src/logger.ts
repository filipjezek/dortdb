import { pino } from 'pino';
import { resolve } from 'node:path';

export const LOG_DIR = resolve(import.meta.dirname, '../dist/logs');

export const logger = pino(
  pino.transport({
    targets: [
      {
        target: 'pino/file',
        options: {
          destination: resolve(LOG_DIR, 'benchmark.log'),
          mkdir: true,
        },
      },
      {
        target: 'pino-pretty',
      },
    ],
  }),
);
