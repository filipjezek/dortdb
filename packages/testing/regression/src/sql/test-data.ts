/**
 * Shared datasets for the SQL regression specs. The expected results in the
 * specs importing this file were verified against PGlite (real Postgres)
 * loaded with the same data.
 */
export const tables: Record<string, Record<string, unknown>[]> = {
  emps: [
    { id: 1, name: 'Alice', dept: 'eng', salary: 100, mgr: null },
    { id: 2, name: 'Bob', dept: 'eng', salary: 80, mgr: 1 },
    { id: 3, name: 'Carol', dept: 'sales', salary: 70, mgr: 1 },
    { id: 4, name: 'Dave', dept: 'sales', salary: 70, mgr: 3 },
    { id: 5, name: 'Eve', dept: 'hr', salary: 60, mgr: 1 },
    { id: 6, name: 'Frank', dept: null, salary: null, mgr: 2 },
  ],
  depts: [
    { dname: 'eng', budget: 1000 },
    { dname: 'sales', budget: 500 },
    { dname: 'marketing', budget: 300 },
  ],
  nums: [
    { n: 1, m: 10 },
    { n: 2, m: null },
    { n: 3, m: 30 },
    { n: 4, m: 40 },
    { n: 5, m: null },
  ],
  strs: [
    { s: 'apple' },
    { s: 'Banana' },
    { s: 'cherry_pie' },
    { s: '' },
    { s: null },
    { s: '100% sure' },
  ],
  docs: [
    { id: 1, body: { tags: ['a', 'b'], meta: { depth: 2 }, title: 'first' } },
    { id: 2, body: { tags: [], title: 'second' } },
    { id: 3, body: { tags: ['b', 'c'], meta: { depth: 5 }, title: 'third' } },
  ],
};
