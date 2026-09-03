// @vitest-environment jsdom
import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { XQuery } from '@dortdb/lang-xquery';
import { defaultRules } from '@dortdb/core/optimizer';

describe('SQL - lateral language switch', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
    additionalLangs: [XQuery()],
  });
  db.registerSource(
    ['test'],
    [{ x: 1 }, { x: 3 }, { x: 2 }, { x: 1 }, { x: 13 }, { x: 3 }],
  );
  db.registerSource(['addresses'], [{}]);

  it('should process lateral join on a lang switch', () => {
    const result = db.query(`
      SELECT test.x AS x
      FROM addresses
      JOIN LATERAL (
      LANG xquery
      1
      ) AS purchased
      JOIN test
      ON test.x = purchased.value
    `);
    expect(result.data).toEqual([{ x: 1 }, { x: 1 }]);
  });
});
