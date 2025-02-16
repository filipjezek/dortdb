import { ASTFunction, DortDB } from '@dortdb/core';
import { XQuery } from '../../src/index.js';
import * as astXQuery from '../../src/ast/index.js';
import { ASTOperator } from '@dortdb/core';

describe('AST Expressions', () => {
  const db = new DortDB({
    mainLang: XQuery,
  });
  const getExpr = (query: string) =>
    (db.parse(query).value[0] as astXQuery.Module).body[0];

  describe('operators', () => {
    it('should preserve operator precedence', () => {
      const result = getExpr('1 + 2 * 3 - 5 div 8 cast as foo < 3');
      const expected = new ASTOperator(
        'xquery',
        new astXQuery.XQueryIdentifier('<'),
        [
          new ASTOperator('xquery', new astXQuery.XQueryIdentifier('-'), [
            new ASTOperator('xquery', new astXQuery.XQueryIdentifier('+'), [
              new astXQuery.ASTNumberLiteral('1'),
              new ASTOperator('xquery', new astXQuery.XQueryIdentifier('*'), [
                new astXQuery.ASTNumberLiteral('2'),
                new astXQuery.ASTNumberLiteral('3'),
              ]),
            ]),
            new ASTOperator('xquery', new astXQuery.XQueryIdentifier('div'), [
              new astXQuery.ASTNumberLiteral('5'),
              new astXQuery.CastExpr(
                new astXQuery.ASTNumberLiteral('8'),
                new astXQuery.XQueryIdentifier('foo'),
              ),
            ]),
          ]),
          new astXQuery.ASTNumberLiteral('3'),
        ],
      );
      expect(result).toEqual(expected);
    });

    it('should preserve associativity', () => {
      const result = getExpr('1 - 2 - 3');
      const expected = new ASTOperator(
        'xquery',
        new astXQuery.XQueryIdentifier('-'),
        [
          new ASTOperator('xquery', new astXQuery.XQueryIdentifier('-'), [
            new astXQuery.ASTNumberLiteral('1'),
            new astXQuery.ASTNumberLiteral('2'),
          ]),
          new astXQuery.ASTNumberLiteral('3'),
        ],
      );
      expect(result).toEqual(expected);
    });
  });

  describe('function calls', () => {
    it('should parse function calls', () => {
      const result = getExpr('foo:bar(1, 2)');
      const expected = new ASTFunction(
        'xquery',
        new astXQuery.XQueryIdentifier('foo:bar'),
        [
          new astXQuery.ASTNumberLiteral('1'),
          new astXQuery.ASTNumberLiteral('2'),
        ],
      );
      expect(result).toEqual(expected);
    });

    it('should parse dynamic function calls', () => {
      const result = getExpr('$x(1, 2)');
      const expected = new astXQuery.DynamicFunctionCall(
        new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
        [
          new astXQuery.ASTNumberLiteral('1'),
          new astXQuery.ASTNumberLiteral('2'),
        ],
      );
      expect(result).toEqual(expected);
    });

    it('should parse bound function calls', () => {
      const result = getExpr('foo:bar(1, ?, 2)');
      const expected = new astXQuery.BoundFunction(
        new astXQuery.XQueryIdentifier('foo:bar'),
        [
          [0, new astXQuery.ASTNumberLiteral('1')],
          [2, new astXQuery.ASTNumberLiteral('2')],
        ],
      );
      expect(result).toEqual(expected);
    });

    it('should parse bound dynamic function calls', () => {
      const result = getExpr('$x(1, ?, 2)');
      const expected = new astXQuery.BoundFunction(
        new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
        [
          [0, new astXQuery.ASTNumberLiteral('1')],
          [2, new astXQuery.ASTNumberLiteral('2')],
        ],
      );
      expect(result).toEqual(expected);
    });
  });

  describe('quantified queries', () => {
    it('should parse quantified queries', () => {
      const result = getExpr('every $x in (1, 2) satisfies $x = 1');
      const expected = new astXQuery.QuantifiedExpr(
        astXQuery.Quantifier.EVERY,
        [
          [
            new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
            new astXQuery.SequenceConstructor([
              new astXQuery.ASTNumberLiteral('1'),
              new astXQuery.ASTNumberLiteral('2'),
            ]),
          ],
        ],
        new ASTOperator('xquery', new astXQuery.XQueryIdentifier('='), [
          new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
          new astXQuery.ASTNumberLiteral('1'),
        ]),
      );
      expect(result).toEqual(expected);
    });

    it('should parse quantified queries with multiple variables', () => {
      const result = getExpr(
        'some $x in (1, 2), $y in (3, 4) satisfies $x * $y = 6',
      );
      const expected = new astXQuery.QuantifiedExpr(
        astXQuery.Quantifier.SOME,
        [
          [
            new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
            new astXQuery.SequenceConstructor([
              new astXQuery.ASTNumberLiteral('1'),
              new astXQuery.ASTNumberLiteral('2'),
            ]),
          ],
          [
            new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('y')),
            new astXQuery.SequenceConstructor([
              new astXQuery.ASTNumberLiteral('3'),
              new astXQuery.ASTNumberLiteral('4'),
            ]),
          ],
        ],
        new ASTOperator('xquery', new astXQuery.XQueryIdentifier('='), [
          new ASTOperator('xquery', new astXQuery.XQueryIdentifier('*'), [
            new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
            new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('y')),
          ]),
          new astXQuery.ASTNumberLiteral('6'),
        ]),
      );
      expect(result).toEqual(expected);
    });
  });

  describe('switch expressions', () => {
    it('should parse switch expressions', () => {
      const result = getExpr(
        'switch ($x) case 1 return 2 case 2 case 3 return 4 default return 5',
      );
      const expected = new astXQuery.SwitchExpr(
        new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
        [
          [
            [new astXQuery.ASTNumberLiteral('1')],
            new astXQuery.ASTNumberLiteral('2'),
          ],
          [
            [
              new astXQuery.ASTNumberLiteral('2'),
              new astXQuery.ASTNumberLiteral('3'),
            ],
            new astXQuery.ASTNumberLiteral('4'),
          ],
        ],
        new astXQuery.ASTNumberLiteral('5'),
      );
      expect(result).toEqual(expected);
    });
  });

  describe('if expressions', () => {
    it('should parse if expressions', () => {
      const result = getExpr('if ($x) then 1 else 2');
      const expected = new astXQuery.IfExpr(
        new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
        new astXQuery.ASTNumberLiteral('1'),
        new astXQuery.ASTNumberLiteral('2'),
      );
      expect(result).toEqual(expected);
    });

    it('should parse nested if expressions', () => {
      const result = getExpr('if ($x) then if ($y) then 1 else 2 else 3');
      const expected = new astXQuery.IfExpr(
        new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
        new astXQuery.IfExpr(
          new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('y')),
          new astXQuery.ASTNumberLiteral('1'),
          new astXQuery.ASTNumberLiteral('2'),
        ),
        new astXQuery.ASTNumberLiteral('3'),
      );
      expect(result).toEqual(expected);
    });
  });

  it('should parse numbers', () => {
    for (const [original, expected] of [
      ['1', 1],
      ['1.2', 1.2],
      ['1.2e2', 1.2e2],
    ]) {
      const result = getExpr(`${original}`);
      expect((result as astXQuery.ASTNumberLiteral).value).toEqual(expected);
    }
  });

  it('should parse strings', () => {
    for (const [original, expected] of [
      ["'hello'", 'hello'],
      ["'hel''lo'", "hel'lo"],
      ['"hello"', 'hello'],
      ['"hel""lo"', 'hel"lo'],
    ]) {
      const result = getExpr(`${original}`);
      expect((result as astXQuery.ASTStringLiteral).value).toEqual(expected);
    }
  });

  describe('comments', () => {
    it('should ignore block comments', () => {
      const result = getExpr('(: com (: 3 :) \nment :)1');
      expect(result).toEqual(new astXQuery.ASTNumberLiteral('1'));
    });
  });
});
