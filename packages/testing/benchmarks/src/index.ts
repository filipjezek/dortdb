import { logger } from './logger.js';
import { parseArgs } from './parse-args.js';
import { runBenchmarkWorker } from './run-benchmark-worker.js';

const args = parseArgs();

const queries = args.query?.length ? args.query : [0];

for (const db of args.database) {
  for (const query of queries) {
    try {
      await runBenchmarkWorker({
        benchmark: args.benchmark,
        database: db,
        query,
        measureInit: true,
        hardTimeout: args.hardTimeout,
        softTimeout: args.softTimeout,
        runs: args.runs,
        snapshotInterval: args.snapshotInterval,
        secondaryIndices:
          args.benchmark === 'unibench' && args.unibench.secondaryIndices,
        skipWarmup: args.skipWarmup,
      });
    } catch (err) {
      logger.error(
        {
          error: err instanceof Error ? err.message : String(err),
          benchmark: args.benchmark,
          database: db,
          query,
        },
        'Benchmark worker failed',
      );
    }
  }
}
