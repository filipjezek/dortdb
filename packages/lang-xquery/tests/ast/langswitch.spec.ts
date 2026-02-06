import { ASTOperator, DortDB, LangSwitch } from '@dortdb/core';
import { XQuery } from '../../src/index.js';
import * as astXQuery from '../../src/ast/index.js';

describe('AST langswitch', () => {
  const db = new DortDB({
    mainLang: XQuery(),
    optimizer: { rules: [] },
  });

  it('should parse langswitch with mutiple scope exits', () => {
    const expected = new astXQuery.Module(new astXQuery.Prolog([]), [
      new ASTOperator('xquery', new astXQuery.XQueryIdentifier('+'), [
        new ASTOperator('xquery', new astXQuery.XQueryIdentifier('+'), [
          new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('z')),
          new LangSwitch('xquery', [
            new astXQuery.Module(new astXQuery.Prolog([]), [
              new ASTOperator('xquery', new astXQuery.XQueryIdentifier('+'), [
                new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('c')),
                new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('d')),
              ]),
            ]),
          ]),
        ]),
        new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('y')),
      ]),
    ]);
    for (const query of [
      '$z + (lang xquery $c + $d) + $y',
      '$z + (lang xquery ($c + $d)) + $y',
      '($z + (lang xquery $c + $d)) + $y',
      '($z + (lang xquery ($c + $d))) + $y',
    ]) {
      const result = db.parse(query)[0];
      expect(result).toEqual(expected);
    }
  });
});
