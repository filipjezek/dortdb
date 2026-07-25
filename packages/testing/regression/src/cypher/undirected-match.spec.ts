import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { defaultRules } from '@dortdb/core/optimizer';
import { createSocialGraph } from './test-graph.js';

describe('Cypher - undirected relationship patterns', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('should bind the other endpoint, not the node itself', () => {
    // KNOWS edges: Alice->Bob, Bob->Carol
    const result = db.query(
      'MATCH (a {name: "Alice"})-[:KNOWS]-(b) RETURN b.name AS b',
    );
    expect(result.data).toEqual([{ b: 'Bob' }]);
  });

  it('should match both directions for a middle node', () => {
    const result = db.query(
      'MATCH (a {name: "Bob"})-[:KNOWS]-(b) RETURN b.name AS b ORDER BY b ASC',
    );
    expect(result.data).toEqual([{ b: 'Alice' }, { b: 'Carol' }]);
  });
});
