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
      dataUrl: args.dataUrl,
      queryIds: args.queryIds,
      runs: args.runs,
      hardTimeout: args.hardTimeout,
      softTimeout: args.softTimeout,
      snapshotInterval: args.snapshotInterval,
      secondaryIndexes: args.benchmark === 'unibench' && args.unibench.secondaryIndexes,
    });
  } catch (error) {
    logger().error({
      event: Events.workerError,
      error: error instanceof Error ? error.message : String(error),
    }, 'Benchmark worker failed');
  }
}
