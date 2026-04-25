import { parentPort } from 'node:worker_threads';
import { BenchmarkWorkerLogMessage } from '../run-benchmark-worker.js';

export function workerLog(details: Record<string, any>, message: string) {
  parentPort.postMessage({
    details,
    message,
  } satisfies BenchmarkWorkerLogMessage);
}
