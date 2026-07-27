import { createCustomEqual, type EqualityComparator } from 'fast-equals';
import { parentPort } from 'node:worker_threads';
import { BenchmarkWorkerLogMessage } from '../run-benchmark-worker.js';

const rtol = 1e-9;
const atol = 1e-9;

function createAreNumbersEqual(
  areNumbersEqual: EqualityComparator<any>,
): EqualityComparator<any> {
  return function (a, b, state) {
    if (!isNaN(a) && !isNaN(b)) {
      if (a % 1 !== 0 || b % 1 !== 0) {
        // Compare numbers with a tolerance to account for floating point precision issues
        const res = Math.abs(a - b) <= atol + rtol * Math.max(Math.abs(a), Math.abs(b));
        // if (!res) {
        //   console.error(
        //     `Numbers ${a} and ${b} differ more than the allowed tolerance.`,
        //   );
        // }
        return res;
      }
    }
    return areNumbersEqual(a, b, state);
  };
}

export const deepEqual = createCustomEqual({
  createCustomConfig: ({ areNumbersEqual }) => ({
    areNumbersEqual: createAreNumbersEqual(areNumbersEqual),
  }),
});

export function promiseTimeout(ms = 0): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function pickRandom<T>(array: T[]): T {
  return array[~~(Math.random() * array.length)];
}

export function workerLog(message: string, details: Record<string, any> = {}) {
  parentPort.postMessage({
    details,
    message,
  } satisfies BenchmarkWorkerLogMessage);
}

export function setupPerformanceObserver() {
  const obs = new PerformanceObserver((items) => {
    items.getEntries().forEach((entry) => {
      workerLog('Performance entry', {
        duration: entry.duration,
        name: entry.name,
        detail: (entry as PerformanceMeasure).detail,
      });
    });
  });
  
  obs.observe({ entryTypes: ['measure'], buffered: false });
}