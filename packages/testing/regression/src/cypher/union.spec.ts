import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { defaultRules } from '@dortdb/core/optimizer';
import { createSocialGraph } from './test-graph.js';

// UNION / UNION ALL between two MATCH queries crashes during planning with
// an internal 'Parent mismatch' error.
describe('Cypher - UNION', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('should union two queries', () => {
    const result = db.query(`
      MATCH (p:Person) RETURN p.name AS name
      UNION
      MATCH (c:Company) RETURN c.name AS name
    `);
    expect(
      new Set(result.data.map((r: Record<string, unknown>) => r.name)),
    ).toEqual(new Set(['Alice', 'Bob', 'Carol', 'Acme']));
  });

  it('should union all two queries', () => {
    const result = db.query(`
      MATCH (p:Person) RETURN p.name AS name
      UNION ALL
      MATCH (p:Person) RETURN p.name AS name
    `);
    expect(result.data).toHaveLength(6);
  });
});
