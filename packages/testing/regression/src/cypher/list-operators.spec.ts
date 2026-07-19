import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { defaultRules } from '@dortdb/core/optimizer';
import { createSocialGraph } from './test-graph.js';

describe('Cypher - list operators', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'social' }),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(['social'], createSocialGraph());

  it('should concatenate lists with +', () => {
    const result = db.query('RETURN [1, 2] + [3] AS r');
    expect(result.data).toEqual([{ r: [1, 2, 3] }]);
  });

  it('should support negative list indices', () => {
    const result = db.query('RETURN [1, 2, 3][-1] AS r');
    expect(result.data).toEqual([{ r: 3 }]);
  });
});
