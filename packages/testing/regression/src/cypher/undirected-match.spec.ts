import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { defaultRules } from '@dortdb/core/optimizer';
import { createSocialGraph } from './test-graph.js';

// Neo4j: an undirected pattern (a)-[:KNOWS]-(b) binds each matching
// relationship once in each direction, with a and b at opposite endpoints.
// DortDB additionally produces self-pairs where a = b.
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
