import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { defaultRules } from '@dortdb/core/optimizer';
import { createSocialGraph } from './test-graph.js';

// Neo4j: a pattern used as a predicate in WHERE can be negated with NOT.
// DortDB evaluates `WHERE NOT (p)-[:WORKS_AT]->()` to an empty result
// (the positive form works).
describe('Cypher - negated pattern predicates', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('should support NOT over a pattern predicate', () => {
    // only Bob has no WORKS_AT relationship
    const result = db.query(
      'MATCH (p:Person) WHERE NOT (p)-[:WORKS_AT]->() RETURN p.name AS name',
    );
    expect(result.data).toEqual([{ name: 'Bob' }]);
  });
});
