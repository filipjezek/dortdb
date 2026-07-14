import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { Projection } from '@dortdb/core/plan';
import { SQL } from '@dortdb/lang-sql';

describe('SQL - unwind', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: defaultRules },
  });

  it('should have correct schema when referring to unqualified attributes', () => {
    const nodes = db.parse(
      'SELECT 1 FROM unwind(orders.Orderline) orderline WHERE productId = 52',
    );
    const plan = db.buildPlan(nodes[0]);

    expect((plan as Projection).source.schema.map((x) => x.parts)).toEqual([
      ['productId'],
    ]);
  });

  it('should execute prefixed VALUES statements', () => {
    const result = db.query('SELECT x.col0 FROM (VALUES (1, 2), (3, 4)) x');
    expect(result.schema).toEqual(['x.col0']);
    expect(result.data).toEqual([{ 'x.col0': 1 }, { 'x.col0': 3 }]);
  });

  it('should execute nonprefixed VALUES statements', () => {
    const result = db.query('SELECT col0 FROM (VALUES (1, 2), (3, 4)) x');
    expect(result.schema).toEqual(['col0']);
    expect(result.data).toEqual([{ col0: 1 }, { col0: 3 }]);
  });

  it('should throw when using unqualified attributes on joined VALUES statements', () => {
    expect(() =>
      db.query(`
        SELECT col0 FROM (VALUES (1, 2), (3, 4)) x
        JOIN (VALUES (1, 13)) y
        ON x.col0 = y.col0
    `),
    ).toThrow('Ambiguous column names: col0');
  });
});
