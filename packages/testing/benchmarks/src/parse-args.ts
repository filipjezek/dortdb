import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export interface BenchmarkArgs {
  benchmark: 'tpch' | 'unibench';
  database: ('alasql' | 'sqlite' | 'arango' | 'orient' | 'dortdb')[];
  query: number[];
  runs: number;
  softTimeout: number;
  hardTimeout: number;
  snapshotInterval: number;
}

export function parseArgs(): BenchmarkArgs {
  const argv = yargs(hideBin(process.argv))
    .option('benchmark', {
      alias: 'b',
      type: 'string',
      description: 'Run a specific benchmark',
      choices: ['tpch', 'unibench'],
    })
    .option('database', {
      alias: 'd',
      type: 'string',
      description: 'Specify the database to use',
      choices: ['alasql', 'sqlite', 'arango', 'orient', 'dortdb'],
      array: true,
      default: ['dortdb'],
    })
    .option('query', {
      alias: 'q',
      type: 'number',
      description: 'Specify the query to run',
      array: true,
    })
    .option('runs', {
      alias: 'r',
      type: 'number',
      description: 'Number of runs for each query',
      default: 5,
    })
    .option('soft-timeout', {
      alias: 'T',
      type: 'number',
      description:
        'Set a soft timeout for all runs of a query in seconds. The query will not be stopped, but the next run will be skipped if the total time exceeds this limit.',
      default: 24 * 60 * 60, // 24 hours,
      defaultDescription: '24 hours',
    })
    .option('timeout', {
      alias: 't',
      type: 'number',
      description:
        'Set a hard timeout for all runs of a query in seconds. The query will be stopped if the time exceeds this limit.',
      default: 24 * 60 * 60, // 24 hours,
      defaultDescription: '24 hours',
    })
    .option('snapshot-interval', {
      alias: 's',
      type: 'number',
      description: 'Interval in seconds for taking snapshots of memory usage',
      default: 0,
      defaultDescription: 'disabled',
    })
    .parseSync();
  return {
    benchmark: argv.benchmark as 'tpch' | 'unibench',
    database: argv.database as (
      | 'alasql'
      | 'sqlite'
      | 'arango'
      | 'orient'
      | 'dortdb'
    )[],
    query: argv.query,
    runs: argv.runs,
    softTimeout: argv['soft-timeout'],
    hardTimeout: argv.timeout,
    snapshotInterval: argv['snapshot-interval'],
  };
}
