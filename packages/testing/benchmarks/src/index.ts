import { unibenchBenchmark } from './unibench/benchmark.js';
import { unibenchBenchmarkArango } from './unibench/benchmark_arango.js';
import { unibenchBenchmarkOrient } from './unibench/benchmark_orient.js';

await unibenchBenchmark();
// await unibenchBenchmarkArango();
// await unibenchBenchmarkOrient();
