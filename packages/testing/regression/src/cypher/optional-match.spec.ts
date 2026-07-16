import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { defaultRules } from '@dortdb/core/optimizer';
import { createSocialGraph } from './test-graph.js';

// Neo4j: when an OPTIONAL MATCH finds nothing, only the variables introduced
// by the optional pattern are null - values bound before it are kept.
// DortDB also nulls out the previously bound variables (a.name is lost).
describe('Cypher - OPTIONAL MATCH', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('should keep outer bindings when the optional pattern does not match', () => {
    const result = db.query(`
      MATCH (a {name: "Alice"})
      OPTIONAL MATCH (a)-[:HATES]->(h)
      RETURN a.name AS an, h AS h
    `);
    expect(result.data).toEqual([{ an: 'Alice', h: null }]);
  });

  it('should only null the optional bindings for non-matching rows', () => {
    // Bob does not work anywhere; Alice and Carol work at Acme
    const result = db.query(`
      MATCH (a:Person)
      OPTIONAL MATCH (a)-[:WORKS_AT]->(c)
      RETURN a.name AS an, c.name AS cn ORDER BY an ASC
    `);
    expect(result.data).toEqual([
      { an: 'Alice', cn: 'Acme' },
      { an: 'Bob', cn: null },
      { an: 'Carol', cn: 'Acme' },
    ]);
  });
});
