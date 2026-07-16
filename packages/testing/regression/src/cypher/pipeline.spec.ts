import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { defaultRules } from '@dortdb/core/optimizer';
import { createSocialGraph } from './test-graph.js';

// Expected results hand-verified against Neo4j/openCypher semantics
// (there is no in-process reference engine for Cypher).

/** order-insensitive row comparison for queries without a top-level ORDER BY */
const sortRows = (rows: unknown[]): string[] =>
  rows
    .map((r) =>
      JSON.stringify(r, (_, v) => (v === undefined ? '__undefined__' : v)),
    )
    .sort();

describe('Cypher - UNWIND, WITH and pagination', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('MATCH (p:Person) RETURN p.name AS name ORDER BY name ASC', () => {
    const result = db.query(
      'MATCH (p:Person) RETURN p.name AS name ORDER BY name ASC',
    );
    expect(result.data).toEqual([
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Carol' },
    ]);
  });

  it('MATCH (p:Person) RETURN p.name AS name ORDER BY name DESC', () => {
    const result = db.query(
      'MATCH (p:Person) RETURN p.name AS name ORDER BY name DESC',
    );
    expect(result.data).toEqual([
      { name: 'Carol' },
      { name: 'Bob' },
      { name: 'Alice' },
    ]);
  });

  it('MATCH (p:Person) RETURN p.name AS name ORDER BY name ASC SKIP 1 LIMIT 1', () => {
    const result = db.query(
      'MATCH (p:Person) RETURN p.name AS name ORDER BY name ASC SKIP 1 LIMIT 1',
    );
    expect(result.data).toEqual([{ name: 'Bob' }]);
  });

  it('MATCH (p:Person) WITH p.age AS a WHERE a > 21 RETURN a', () => {
    const result = db.query(
      'MATCH (p:Person) WITH p.age AS a WHERE a > 21 RETURN a',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ a: 30 }]));
  });

  it('UNWIND [1, 2, 3] AS x RETURN x * 10 AS r', () => {
    const result = db.query('UNWIND [1, 2, 3] AS x RETURN x * 10 AS r');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ r: 10 }, { r: 20 }, { r: 30 }]),
    );
  });

  it('UNWIND [] AS x RETURN x', () => {
    const result = db.query('UNWIND [] AS x RETURN x');
    expect(sortRows(result.data)).toEqual(sortRows([]));
  });

  it('UNWIND [1, 2, 2, 3] AS x RETURN DISTINCT x', () => {
    const result = db.query('UNWIND [1, 2, 2, 3] AS x RETURN DISTINCT x');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ x: 1 }, { x: 2 }, { x: 3 }]),
    );
  });

  it('UNWIND [[1, 2], [3]] AS x UNWIND x AS y RETURN y', () => {
    const result = db.query('UNWIND [[1, 2], [3]] AS x UNWIND x AS y RETURN y');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ y: 1 }, { y: 2 }, { y: 3 }]),
    );
  });

  it('UNWIND [3, 1, 2] AS x RETURN x ORDER BY x DESC', () => {
    const result = db.query('UNWIND [3, 1, 2] AS x RETURN x ORDER BY x DESC');
    expect(result.data).toEqual([{ x: 3 }, { x: 2 }, { x: 1 }]);
  });
});
