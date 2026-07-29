import { Worker } from 'node:worker_threads';
import { Events, isWorkerLogMessage, logger } from './utils/logger.js';

export type BenchmarkWorkerOptions = {
  benchmark: BenchmarkName;
  database: DatabaseName;
  dataUrl: string | undefined;
  queryIds: number[];
  runs: number[];
  /** in seconds */
  hardTimeout: number;
  /** in seconds */
  softTimeout: number;
  snapshotInterval: number;
  secondaryIndexes: boolean;
};

export const AVAILABLE_BENCHMARKS = [ 'tpch', 'unibench' ] as const;
export type BenchmarkName = typeof AVAILABLE_BENCHMARKS[number];

export const AVAILABLE_DATABASES = [ 'alasql', 'sqlite', 'arango', 'orient', 'dortdb' ] as const;
export type DatabaseName = typeof AVAILABLE_DATABASES[number];

const BENCHMARK_WORKER_MODULES: Record<BenchmarkName, Partial<Record<DatabaseName, string>>> = {
  tpch: {
    alasql: './tpch/benchmark_alasql.js',
    sqlite: './tpch/benchmark_sqlite.js',
    dortdb: './tpch/benchmark_dortdb.js',
  },
  unibench: {
    dortdb: './unibench/benchmark_dortdb.js',
    arango: './unibench/benchmark_arango.js',
    orient: './unibench/benchmark_orient.js',
  },
};

function resolveWorkerScript(options: BenchmarkWorkerOptions): URL {
  const scriptPath = BENCHMARK_WORKER_MODULES[options.benchmark][options.database];
  if (!scriptPath)
    throw new Error(`No worker script configured for ${options.benchmark}/${options.database}`);

  return new URL(scriptPath, import.meta.url);
}

export async function runBenchmarkWorker(options: BenchmarkWorkerOptions): Promise<void> {
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
        // Finish will be called automatically by the 'exit' event.
        logger().error({ event: Events.hardTimeout }, `Worker timed out after ${options.hardTimeout}s`);

        worker.terminate().catch((error: unknown) => {
          finish(() => reject(error));
        });
      }, timeoutMs);
    }

    worker.on('message', (value: unknown) => {
      if (isWorkerLogMessage(value)) {
        const messageObject = {
          event: value.event,
          ...value.details,
        };

        if (value.isError)
          logger().error(messageObject, value.message);
        else
          logger().info(messageObject, value.message);

        if (
          value.event === Events.environmentSetup &&
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
          reject(new Error(`Worker exited with code ${code} (${options.benchmark}/${options.database}, q${options.queryIds})`));
        });
        return;
      }
      finish(resolve);
    });
  });
}

function setupMemorySnapshots(options: BenchmarkWorkerOptions): NodeJS.Timeout {
  return setInterval(() => {
    logger().info({
      event: Events.memorySnapshot,
      ...process.memoryUsage(),
    }, 'Memory snapshot');
  }, options.snapshotInterval * 1000);
}
