import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export type BenchmarkArgs = {
  benchmark: 'tpch' | 'unibench';
  database: DatabaseName[];
  query: number[];
  dataUrl: string | undefined;
  runs: number;
  softTimeout: number;
  hardTimeout: number;
  snapshotInterval: number;
  unibench: {
    secondaryIndexes: boolean;
  };
  output?: string;
};

type DatabaseName = 'alasql' | 'sqlite' | 'arango' | 'orient' | 'dortdb';

export function parseArgs(): BenchmarkArgs {
  const argv = yargs(hideBin(process.argv))
    .option('benchmark', {
      alias: 'b',
      type: 'string',
      description: 'Run a specific benchmark',
      choices: ['tpch', 'unibench'],
      required: true,
    })
    .option('database', {
      alias: 'd',
      type: 'string',
      description: 'Specify the database to use',
      choices: ['alasql', 'sqlite', 'arango', 'orient', 'dortdb'],
      array: true,
      required: true,
    })
    .option('query', {
      alias: 'q',
      type: 'number',
      description: 'Specify the query to run',
      array: true,
      required: true,
    })
    .option('data-url', {
      alias: 'u',
      type: 'string',
      description: 'URL to fetch the data from. Each benchmark has a default URL, but you can override it with this option.',
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
      description: 'Set a soft timeout for all runs of a query in seconds. The query will not be stopped, but the next run will be skipped if the total time exceeds this limit.',
      default: 24 * 60 * 60, // 24 hours,
      defaultDescription: '24 hours',
    })
    .option('timeout', {
      alias: 't',
      type: 'number',
      description: 'Set a hard timeout for all runs of a query in seconds. The query will be stopped if the time exceeds this limit.',
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
    .option('unibench-secondary-indexes', {
      type: 'boolean',
      description: 'Whether to create secondary indexes for the Unibench benchmark. The original Unibench paper uses only primary indexes.',
      default: false,
    })
    .option('output', {
      type: 'string',
      alias: 'o',
      description: 'Output file name',
      default: undefined,
      defaultDescription: 'based on other parameters',
    })
    .parseSync();

  return {
    benchmark: argv.benchmark as BenchmarkArgs['benchmark'],
    database: argv.database as BenchmarkArgs['database'],
    query: argv.query,
    dataUrl: argv['data-url'],
    runs: argv.runs,
    softTimeout: argv['soft-timeout'],
    hardTimeout: argv.timeout,
    snapshotInterval: argv['snapshot-interval'],
    unibench: {
      secondaryIndexes: argv['unibench-secondary-indexes'],
    },
    output: argv.output,
  };
}
