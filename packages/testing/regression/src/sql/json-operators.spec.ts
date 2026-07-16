import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { defaultRules } from '@dortdb/core/optimizer';

// The `->` operator references the global `Element` class, which exists in
// browsers but not in Node, so any query using `->` throws
// 'Element is not defined' when running server-side.
describe('SQL - JSON access operators in Node', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });
  db.registerSource(
    ['docs'],
    [
      { id: 1, body: { title: 'first', tags: ['a', 'b'] } },
      { id: 2, body: { title: 'second', tags: [] } },
    ],
  );

  it('should access object properties with ->', () => {
    const result = db.query(`SELECT body -> 'title' AS t FROM docs`);
    expect(result.data).toEqual([{ t: 'first' }, { t: 'second' }]);
  });

  it('should access array elements with ->', () => {
    const result = db.query(`SELECT body -> 'tags' -> 0 AS t FROM docs`);
    expect(result.data).toEqual([{ t: 'a' }, { t: undefined }]);
  });
});
