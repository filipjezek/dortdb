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

describe('Cypher - aggregation', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('MATCH (p:Person) RETURN count(*) AS c', () => {
    const result = db.query('MATCH (p:Person) RETURN count(*) AS c');
    expect(sortRows(result.data)).toEqual(sortRows([{ c: 3 }]));
  });

  it('MATCH (p:Person) RETURN count(p.age) AS c', () => {
    const result = db.query('MATCH (p:Person) RETURN count(p.age) AS c');
    expect(sortRows(result.data)).toEqual(sortRows([{ c: 2 }]));
  });

  it('MATCH (p:Person) RETURN avg(p.age) AS a, min(p.age) AS mn, max(p.age) AS mx', () => {
    const result = db.query(
      'MATCH (p:Person) RETURN avg(p.age) AS a, min(p.age) AS mn, max(p.age) AS mx',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ a: 25, mn: 20, mx: 30 }]),
    );
  });

  it('MATCH (p:Person) RETURN sum(p.age) AS s', () => {
    const result = db.query('MATCH (p:Person) RETURN sum(p.age) AS s');
    expect(sortRows(result.data)).toEqual(sortRows([{ s: 50 }]));
  });

  it('MATCH (p:Person) RETURN collect(p.name) AS names', () => {
    const result = db.query('MATCH (p:Person) RETURN collect(p.name) AS names');
    expect(sortRows(result.data)).toEqual(
      sortRows([{ names: ['Alice', 'Bob', 'Carol'] }]),
    );
  });

  it('MATCH (a)-[:WORKS_AT]->(c) RETURN c.name AS company, count(*) AS headcount', () => {
    const result = db.query(
      'MATCH (a)-[:WORKS_AT]->(c) RETURN c.name AS company, count(*) AS headcount',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ company: 'Acme', headcount: 2 }]),
    );
  });

  it('MATCH (a)-[:WORKS_AT]->(c) RETURN collect(DISTINCT c.name) AS r', () => {
    const result = db.query(
      'MATCH (a)-[:WORKS_AT]->(c) RETURN collect(DISTINCT c.name) AS r',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ r: ['Acme'] }]));
  });
});
