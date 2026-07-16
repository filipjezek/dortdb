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

describe('Cypher - pattern matching', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('MATCH (a)-[:KNOWS]->(b) RETURN a.name AS a, b.name AS b', () => {
    const result = db.query(
      'MATCH (a)-[:KNOWS]->(b) RETURN a.name AS a, b.name AS b',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { a: 'Alice', b: 'Bob' },
        { a: 'Bob', b: 'Carol' },
      ]),
    );
  });

  it('MATCH (a)<-[:KNOWS]-(b) RETURN a.name AS a, b.name AS b', () => {
    const result = db.query(
      'MATCH (a)<-[:KNOWS]-(b) RETURN a.name AS a, b.name AS b',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { a: 'Bob', b: 'Alice' },
        { a: 'Carol', b: 'Bob' },
      ]),
    );
  });

  it('MATCH (a:Admin:Person) RETURN a.name AS name', () => {
    const result = db.query('MATCH (a:Admin:Person) RETURN a.name AS name');
    expect(sortRows(result.data)).toEqual(sortRows([{ name: 'Carol' }]));
  });

  it('MATCH (a {name: "Alice"})-[:KNOWS *1..2]->(f) RETURN f.name AS name', () => {
    const result = db.query(
      'MATCH (a {name: "Alice"})-[:KNOWS *1..2]->(f) RETURN f.name AS name',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ name: 'Bob' }, { name: 'Carol' }]),
    );
  });

  it('MATCH (a)-[r:KNOWS]->(b) WHERE r.since > 2012 RETURN b.name AS name', () => {
    const result = db.query(
      'MATCH (a)-[r:KNOWS]->(b) WHERE r.since > 2012 RETURN b.name AS name',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ name: 'Carol' }]));
  });

  it('MATCH (a)-[r]->(b) WHERE type(r) = "WORKS_AT" RETURN a.name AS name', () => {
    const result = db.query(
      'MATCH (a)-[r]->(b) WHERE type(r) = "WORKS_AT" RETURN a.name AS name',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ name: 'Alice' }, { name: 'Carol' }]),
    );
  });

  it('MATCH ()-[r:KNOWS]->() RETURN type(r) AS t, r.since AS since', () => {
    const result = db.query(
      'MATCH ()-[r:KNOWS]->() RETURN type(r) AS t, r.since AS since',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { t: 'KNOWS', since: 2010 },
        { t: 'KNOWS', since: 2015 },
      ]),
    );
  });

  it('MATCH (p:Person) RETURN DISTINCT labels(p) AS l', () => {
    const result = db.query('MATCH (p:Person) RETURN DISTINCT labels(p) AS l');
    expect(sortRows(result.data)).toEqual(
      sortRows([
        { l: ['Person'] },
        { l: ['Person'] },
        { l: ['Person', 'Admin'] },
      ]),
    );
  });

  it('MATCH (p:Person) WHERE p.age >= 20 AND p.age <= 30 RETURN p.name AS name', () => {
    const result = db.query(
      'MATCH (p:Person) WHERE p.age >= 20 AND p.age <= 30 RETURN p.name AS name',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ name: 'Alice' }, { name: 'Bob' }]),
    );
  });

  it('MATCH (p:Person) WHERE p.age > 18 OR p.missing > 5 RETURN p.name AS name', () => {
    const result = db.query(
      'MATCH (p:Person) WHERE p.age > 18 OR p.missing > 5 RETURN p.name AS name',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ name: 'Alice' }, { name: 'Bob' }]),
    );
  });

  it('MATCH (p:Person) WHERE (p)-[:WORKS_AT]->() RETURN p.name AS name', () => {
    const result = db.query(
      'MATCH (p:Person) WHERE (p)-[:WORKS_AT]->() RETURN p.name AS name',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ name: 'Alice' }, { name: 'Carol' }]),
    );
  });

  it('MATCH (n {name: "Nobody"}) RETURN n.name AS name', () => {
    const result = db.query('MATCH (n {name: "Nobody"}) RETURN n.name AS name');
    expect(sortRows(result.data)).toEqual(sortRows([]));
  });

  it('MATCH (a:Company) MATCH (b:Company) RETURN a.name AS an, b.name AS bn', () => {
    const result = db.query(
      'MATCH (a:Company) MATCH (b:Company) RETURN a.name AS an, b.name AS bn',
    );
    expect(sortRows(result.data)).toEqual(
      sortRows([{ an: 'Acme', bn: 'Acme' }]),
    );
  });
});
