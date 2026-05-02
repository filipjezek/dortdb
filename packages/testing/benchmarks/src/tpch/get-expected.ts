import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const QUERY_DIR = resolve(import.meta.dirname, '../../src/tpch/queries');

export function getExpectedResult(query: number, convertDates = true): any[] {
  const result = JSON.parse(
    readFileSync(resolve(QUERY_DIR, `tpch-q${query}.json`), 'utf-8'),
  ) as any[];
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$/;
  if (!convertDates) return result;

  return result.map((row) => {
    for (const key in row) {
      if (typeof row[key] === 'string' && dateRegex.test(row[key])) {
        row[key] = new Date(row[key]);
      }
    }
    return row;
  });
}
