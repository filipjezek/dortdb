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

describe('Cypher - expressions', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('RETURN 1 + 2 AS r', () => {
    const result = db.query('RETURN 1 + 2 AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 3 }]));
  });

  it('RETURN "a" + "b" AS r', () => {
    const result = db.query('RETURN "a" + "b" AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 'ab' }]));
  });

  it('RETURN 1 + null AS r', () => {
    const result = db.query('RETURN 1 + null AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: null }]));
  });

  it('RETURN "a" + null AS r', () => {
    const result = db.query('RETURN "a" + null AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: null }]));
  });

  it('RETURN 7 % 2 AS r', () => {
    const result = db.query('RETURN 7 % 2 AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 1 }]));
  });

  it('RETURN 2 ^ 3 AS r', () => {
    const result = db.query('RETURN 2 ^ 3 AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 8 }]));
  });

  it('RETURN null = null AS r', () => {
    const result = db.query('RETURN null = null AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: null }]));
  });

  it('RETURN CASE WHEN 1 < 2 THEN "y" ELSE "n" END AS r', () => {
    const result = db.query(
      'RETURN CASE WHEN 1 < 2 THEN "y" ELSE "n" END AS r',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 'y' }]));
  });

  it('RETURN CASE 2 WHEN 1 THEN "one" WHEN 2 THEN "two" END AS r', () => {
    const result = db.query(
      'RETURN CASE 2 WHEN 1 THEN "one" WHEN 2 THEN "two" END AS r',
    );
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 'two' }]));
  });

  it('RETURN [x IN [1,2,3] WHERE x > 1 | x * 10] AS r', () => {
    const result = db.query('RETURN [x IN [1,2,3] WHERE x > 1 | x * 10] AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: [20, 30] }]));
  });

  it('RETURN [1,2,3][0] AS r', () => {
    const result = db.query('RETURN [1,2,3][0] AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 1 }]));
  });

  it('RETURN [1,2,3][0..2] AS r', () => {
    const result = db.query('RETURN [1,2,3][0..2] AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: [1, 2] }]));
  });

  it('RETURN [1,2,3][1..] AS r', () => {
    const result = db.query('RETURN [1,2,3][1..] AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: [2, 3] }]));
  });

  it('RETURN {a: 1, b: 2}.a AS r', () => {
    const result = db.query('RETURN {a: 1, b: 2}.a AS r');
    expect(sortRows(result.data)).toEqual(sortRows([{ r: 1 }]));
  });
});
