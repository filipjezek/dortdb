import { Events, logger, setupLogger } from './utils/logger.js';
import { parseArgs } from './parse-args.js';
import { runBenchmarkWorker } from './run-benchmark-worker.js';

await main();

async function main() {
  const args = parseArgs();

  setupLogger(args);

  try {
    await runBenchmarkWorker({
      benchmark: args.benchmark,
      database: args.database,
      query: args.query,
      dataUrl: args.dataUrl,
      hardTimeout: args.hardTimeout,
      softTimeout: args.softTimeout,
      runs: args.runs,
      snapshotInterval: args.snapshotInterval,
      secondaryIndexes: args.benchmark === 'unibench' && args.unibench.secondaryIndexes,
    });
  } catch (err) {
    logger().error({
      event: Events.workerError,
      error: err instanceof Error ? err.message : String(err),
    }, 'Benchmark worker failed');
  }
}
