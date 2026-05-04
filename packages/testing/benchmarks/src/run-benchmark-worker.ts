import { BenchmarkArgs } from './parse-args.js';
import { Worker } from 'node:worker_threads';
import { logger } from './logger.js';

export interface BenchmarkWorkerOptions {
  benchmark: BenchmarkArgs['benchmark'];
  database: BenchmarkArgs['database'][number];
  query: BenchmarkArgs['query'][number];
  measureInit: boolean;
  /** in seconds */
  hardTimeout: number;
  /** in seconds */
  softTimeout: number;
  runs: number;
  snapshotInterval: number;
  secondaryIndices: boolean;
  skipWarmup: boolean;
}

export interface BenchmarkWorkerLogMessage {
  details: Record<string, any>;
  message: string;
}

const BENCHMARK_WORKER_MODULES: Record<
  BenchmarkArgs['benchmark'],
  Partial<Record<BenchmarkArgs['database'][number], string>>
> = {
  tpch: {
    alasql: './tpch/benchmark-alasql.js',
    sqlite: './tpch/benchmark-sqlite.js',
    dortdb: './tpch/benchmark.js',
  },
  unibench: {
    dortdb: './unibench/benchmark.js',
    arango: './unibench/benchmark_arango.js',
    orient: './unibench/benchmark_orient.js',
  },
};

function resolveWorkerScript(options: BenchmarkWorkerOptions): URL {
  const scriptPath =
    BENCHMARK_WORKER_MODULES[options.benchmark][options.database];
  if (!scriptPath) {
    throw new Error(
      `No worker script configured for ${options.benchmark}/${options.database}`,
    );
  }
  return new URL(scriptPath, import.meta.url);
}

export async function runBenchmarkWorker(
  options: BenchmarkWorkerOptions,
): Promise<void> {
  const workerScript = resolveWorkerScript(options);

  await new Promise<void>((resolve, reject) => {
    const worker = new Worker(workerScript, {
      workerData: options,
    });

    const timeoutMs = Math.max(options.hardTimeout, 0) * 1000;
    let settled = false;
    let timeoutId: NodeJS.Timeout;
    let snapshotIntervalId: NodeJS.Timeout;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (snapshotIntervalId) {
        clearInterval(snapshotIntervalId);
      }
      callback();
    };

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        // finish will be called automatically by the 'exit' event
        logger.error(
          {
            benchmark: options.benchmark,
            database: options.database,
            query: options.query,
          },
          `Worker timed out after ${options.hardTimeout}s`,
        );
        worker.terminate().catch((error: unknown) => {
          finish(() => reject(error));
        });
      }, timeoutMs);
    }

    worker.on('message', (value: unknown) => {
      if (
        typeof value === 'object' &&
        value !== null &&
        'message' in value &&
        'details' in value
      ) {
        const msg = value as BenchmarkWorkerLogMessage;
        logger.info(msg.details, msg.message);

        if (
          msg.message === 'Finished preparing environment' &&
          options.snapshotInterval > 0
        ) {
          snapshotIntervalId = setupMemorySnapshots(options);
        }
      }
    });

    worker.on('error', (error) => {
      finish(() => reject(error));
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        finish(() => {
          reject(
            new Error(
              `Worker exited with code ${code} (${options.benchmark}/${options.database}, q${options.query})`,
            ),
          );
        });
        return;
      }
      finish(resolve);
    });
  });
}

function setupMemorySnapshots(options: BenchmarkWorkerOptions): NodeJS.Timeout {
  return setInterval(() => {
    logger.info(
      {
        benchmark: options.benchmark,
        database: options.database,
        query: options.query,
        ...process.memoryUsage(),
      },
      'Memory snapshot',
    );
  }, options.snapshotInterval * 1000);
}
