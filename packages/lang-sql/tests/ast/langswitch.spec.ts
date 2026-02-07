import { ASTOperator, DortDB, LangSwitch } from '@dortdb/core';
import { SQL } from '../../src/index.js';
import * as astSQL from '../../src/ast/index.js';

describe('AST langswitch', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: [] },
  });

  it('should parse langswitch with mutiple scope exits', () => {
    const expected = new astSQL.SelectStatement(
      new astSQL.SelectSet(
        [
          new astSQL.SQLIdentifier('x'),
          new ASTOperator('sql', new astSQL.SQLIdentifier('+'), [
            new ASTOperator('sql', new astSQL.SQLIdentifier('+'), [
              new astSQL.SQLIdentifier('z'),
              new LangSwitch('sql', [
                new astSQL.SelectStatement(
                  new astSQL.SelectSet([
                    new ASTOperator('sql', new astSQL.SQLIdentifier('+'), [
                      new astSQL.SQLIdentifier('c', 'foo'),
                      new astSQL.SQLIdentifier('d', 'foo'),
                    ]),
                  ]),
                ),
              ]),
            ]),
            new astSQL.SQLIdentifier('y'),
          ]),
        ],
        new astSQL.SQLIdentifier('foo'),
      ),
    );
    for (const query of [
      'select x, z + (lang sql select foo.c + foo.d) + y from foo',
      'select x, z + (lang sql select (foo.c + foo.d)) + y from foo',
      'select x, (z + (lang sql select foo.c + foo.d)) + y from foo',
      'select x, (z + (lang sql select (foo.c + foo.d))) + y from foo',
    ]) {
      const result = db.parse(query)[0];
      expect(result).toEqual(expected);
    }
  });
});
