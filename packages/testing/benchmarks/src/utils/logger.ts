import { Logger, pino, transport } from 'pino';
import { resolve } from 'node:path';
import type { BenchmarkArgs } from '../parse-args.js';
import { parentPort } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';

const LOG_DIR = resolve(import.meta.dirname, '../../dist/logs');

declare module 'pino' {
  // Force the `event` field to be required in the log message details.
  interface LogFnFields {
    event: EventType;
  }
}

let loggerInstance: Logger | undefined = undefined;

export function logger() {
  if (!loggerInstance)
    throw new Error(
      'Logger not initialized. Call `setupLogger()` before using the logger.',
    );

  return loggerInstance;
}

export function setupLogger(args: BenchmarkArgs) {
  const logger = createLogger(args);
  // All log messages will be prefixed with a unique run ID to distinguish between different benchmark runs.
  // This is important because log files are appended to, and we want to be able to distinguish between different runs in the same log file.
  const runId = randomUUID();
  loggerInstance = logger.child({ runId });

  loggerInstance.info(
    {
      event: Events.runStarted,
      config: {
        ...args,
        // Hide the data URL if it's not an HTTPS URL to avoid logging sensitive information.
        // Could be a connection string to a database.
        dataUrl: args.dataUrl?.startsWith('https://')
          ? args.dataUrl
          : '[REDACTED]',
      },
    },
    `Benchmark run started`,
  );
}

function createLogger(args: BenchmarkArgs) {
  return pino(
    transport({
      targets: [
        {
          target: 'pino/file',
          options: {
            destination: resolve(LOG_DIR, getLogFilename(args)),
            mkdir: true,
          },
        },
        {
          target: 'pino-pretty',
        },
      ],
    }),
  );
}

function getLogFilename(args: BenchmarkArgs) {
  if (args.output) return args.output;

  return `${args.benchmark}_${args.database}.log`;
}

type WorkerLogMessage = {
  event: EventType;
  details: Record<string, unknown>;
  message: string;
  isError: boolean;
};

export function isWorkerLogMessage(value: unknown): value is WorkerLogMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'event' in value &&
    'details' in value &&
    'message' in value
  );
}

export function workerLog(
  event: EventType,
  message: string,
  details: Record<string, unknown> = {},
  isError = false,
) {
  parentPort.postMessage({
    event,
    details,
    message,
    isError,
  } satisfies WorkerLogMessage);
}

type EventType = (typeof Events)[keyof typeof Events];

export const Events = {
  runStarted: 'run-started',
  workerError: 'worker-error',
  softTimeout: 'soft-timeout',
  hardTimeout: 'hard-timeout',
  queryError: 'query-error',
  memorySnapshot: 'memory-snapshot',
  dataParsed: 'data-parsed',
  environmentSetup: 'environment-setup',
  runQuery: 'run-query',
  queryExecuted: 'query-executed',
  memoryBeforeQuery: 'memory-before-query',
  memoryAfterQuery: 'memory-after-query',
  queryResultRight: 'query-result-right',
  queryResultWrong: 'query-result-wrong',
};
