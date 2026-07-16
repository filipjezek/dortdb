import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { defaultRules } from '@dortdb/core/optimizer';
import { createSocialGraph } from './test-graph.js';

// Neo4j: a variable-length pattern with lower bound 0 also matches the
// zero-length path, binding the start node itself. DortDB drops the
// zero-length case entirely (*0..0 matches nothing).
describe('Cypher - zero-length variable paths', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('should match the start node itself with *0..0', () => {
    const result = db.query(
      'MATCH (a {name: "Alice"})-[:KNOWS *0..0]->(f) RETURN f.name AS name',
    );
    expect(result.data).toEqual([{ name: 'Alice' }]);
  });

  it('should include the zero-length path with *0..1', () => {
    const result = db.query(
      'MATCH (a {name: "Alice"})-[:KNOWS *0..1]->(f) RETURN f.name AS name ORDER BY name ASC',
    );
    expect(result.data).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
  });
});
