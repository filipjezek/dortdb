import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { defaultRules } from '@dortdb/core/optimizer';
import { createSocialGraph } from './test-graph.js';

describe('Cypher - ORDER BY default direction', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('should sort ascending by default', () => {
    const result = db.query(
      'MATCH (p:Person) RETURN p.name AS name ORDER BY name',
    );
    expect(result.data).toEqual([
      { name: 'Alice' },
      { name: 'Bob' },
      { name: 'Carol' },
    ]);
  });

  it('should sort ascending by default inside a WITH pipeline', () => {
    const result = db.query(
      'MATCH (p:Person) WITH p ORDER BY p.name LIMIT 2 RETURN p.name AS name',
    );
    expect(result.data).toEqual([{ name: 'Alice' }, { name: 'Bob' }]);
  });
});
