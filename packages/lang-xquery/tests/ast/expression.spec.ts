import { describe, it } from 'node:test';
import { ASTFunction, ASTNode, DortDB } from '@dortdb/core';
import { XQuery } from '../../src/index.js';
import assert from 'node:assert/strict';
import * as astXQuery from '../../src/ast/index.js';
import { ASTOperator } from '@dortdb/core';

describe('AST Expressions', () => {
  const db = new DortDB({
    mainLang: XQuery,
  });
  const wrapPath = (lit: ASTNode) => new astXQuery.PathExpr([lit]);

  describe('operators', () => {
    it('should preserve operator precedence', () => {
      const result = db.parse('1 + 2 * 3 - 5 div 8 cast as foo').value.body;
      const expected = [
        new ASTOperator('xquery', new astXQuery.ASTName('-'), [
          new ASTOperator('xquery', new astXQuery.ASTName('+'), [
            wrapPath(new astXQuery.ASTNumberLiteral('1')),
            new ASTOperator('xquery', new astXQuery.ASTName('*'), [
              wrapPath(new astXQuery.ASTNumberLiteral('2')),
              wrapPath(new astXQuery.ASTNumberLiteral('3')),
            ]),
          ]),
          new ASTOperator('xquery', new astXQuery.ASTName('div'), [
            wrapPath(new astXQuery.ASTNumberLiteral('5')),
            new astXQuery.CastExpr(
              wrapPath(new astXQuery.ASTNumberLiteral('8')),
              new astXQuery.ASTName('foo')
            ),
          ]),
        ]),
      ];
      assert.deepEqual(result, expected);
    });

    it('should preserve associativity', () => {
      const result = db.parse('1 - 2 - 3').value.body;
      const expected = [
        new ASTOperator('xquery', new astXQuery.ASTName('-'), [
          new ASTOperator('xquery', new astXQuery.ASTName('-'), [
            wrapPath(new astXQuery.ASTNumberLiteral('1')),
            wrapPath(new astXQuery.ASTNumberLiteral('2')),
          ]),
          wrapPath(new astXQuery.ASTNumberLiteral('3')),
        ]),
      ];
      assert.deepEqual(result, expected);
    });
  });

  describe('function calls', () => {
    it('should parse function calls', () => {
      const result = db.parse('foo:bar(1, 2)').value.body[0];
      const expected = wrapPath(
        new ASTFunction('xquery', new astXQuery.ASTName('foo:bar'), [
          wrapPath(new astXQuery.ASTNumberLiteral('1')),
          wrapPath(new astXQuery.ASTNumberLiteral('2')),
        ])
      );
      assert.deepEqual(result, expected);
    });

    it('should parse dynamic function calls', () => {
      const result = db.parse('$x(1, 2)').value.body[0];
      const expected = wrapPath(
        new astXQuery.DynamicFunctionCall(
          new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
          [
            wrapPath(new astXQuery.ASTNumberLiteral('1')),
            wrapPath(new astXQuery.ASTNumberLiteral('2')),
          ]
        )
      );
      assert.deepEqual(result, expected);
    });

    it('should parse bound function calls', () => {
      const result = db.parse('foo:bar(1, ?, 2)').value.body[0];
      const expected = wrapPath(
        new astXQuery.BoundFunction(new astXQuery.ASTName('foo:bar'), [
          [0, wrapPath(new astXQuery.ASTNumberLiteral('1'))],
          [2, wrapPath(new astXQuery.ASTNumberLiteral('2'))],
        ])
      );
      assert.deepEqual(result, expected);
    });

    it('should parse bound dynamic function calls', () => {
      const result = db.parse('$x(1, ?, 2)').value.body[0];
      const expected = wrapPath(
        new astXQuery.BoundFunction(
          new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
          [
            [0, wrapPath(new astXQuery.ASTNumberLiteral('1'))],
            [2, wrapPath(new astXQuery.ASTNumberLiteral('2'))],
          ]
        )
      );
      assert.deepEqual(result, expected);
    });
  });

  describe('quantified queries', () => {
    it('should parse quantified queries', () => {
      const result = db.parse('every $x in (1, 2) satisfies $x = 1').value
        .body[0];
      const expected = new astXQuery.QuantifiedExpr(
        'every',
        [
          [
            new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
            wrapPath(
              new astXQuery.SequenceConstructor([
                wrapPath(new astXQuery.ASTNumberLiteral('1')),
                wrapPath(new astXQuery.ASTNumberLiteral('2')),
              ])
            ),
          ],
        ],
        new ASTOperator('xquery', new astXQuery.ASTName('='), [
          wrapPath(new astXQuery.ASTVariable(new astXQuery.ASTName('x'))),
          wrapPath(new astXQuery.ASTNumberLiteral('1')),
        ])
      );
      assert.deepEqual(result, expected);
    });

    it('should parse quantified queries with multiple variables', () => {
      const result = db.parse(
        'some $x in (1, 2), $y in (3, 4) satisfies $x * $y = 6'
      ).value.body[0];
      const expected = new astXQuery.QuantifiedExpr(
        'some',
        [
          [
            new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
            wrapPath(
              new astXQuery.SequenceConstructor([
                wrapPath(new astXQuery.ASTNumberLiteral('1')),
                wrapPath(new astXQuery.ASTNumberLiteral('2')),
              ])
            ),
          ],
          [
            new astXQuery.ASTVariable(new astXQuery.ASTName('y')),
            wrapPath(
              new astXQuery.SequenceConstructor([
                wrapPath(new astXQuery.ASTNumberLiteral('3')),
                wrapPath(new astXQuery.ASTNumberLiteral('4')),
              ])
            ),
          ],
        ],
        new ASTOperator('xquery', new astXQuery.ASTName('='), [
          new ASTOperator('xquery', new astXQuery.ASTName('*'), [
            wrapPath(new astXQuery.ASTVariable(new astXQuery.ASTName('x'))),
            wrapPath(new astXQuery.ASTVariable(new astXQuery.ASTName('y'))),
          ]),
          wrapPath(new astXQuery.ASTNumberLiteral('6')),
        ])
      );
      assert.deepEqual(result, expected);
    });
  });

  describe('switch expressions', () => {
    it('should parse switch expressions', () => {
      const result = db.parse(
        'switch ($x) case 1 return 2 case 2 case 3 return 4 default return 5'
      ).value.body[0];
      const expected = new astXQuery.SwitchExpr(
        wrapPath(new astXQuery.ASTVariable(new astXQuery.ASTName('x'))),
        [
          [
            [wrapPath(new astXQuery.ASTNumberLiteral('1'))],
            wrapPath(new astXQuery.ASTNumberLiteral('2')),
          ],
          [
            [
              wrapPath(new astXQuery.ASTNumberLiteral('2')),
              wrapPath(new astXQuery.ASTNumberLiteral('3')),
            ],
            wrapPath(new astXQuery.ASTNumberLiteral('4')),
          ],
        ],
        wrapPath(new astXQuery.ASTNumberLiteral('5'))
      );
      assert.deepEqual(result, expected);
    });
  });

  describe('if expressions', () => {
    it('should parse if expressions', () => {
      const result = db.parse('if ($x) then 1 else 2').value.body[0];
      const expected = new astXQuery.IfExpr(
        wrapPath(new astXQuery.ASTVariable(new astXQuery.ASTName('x'))),
        wrapPath(new astXQuery.ASTNumberLiteral('1')),
        wrapPath(new astXQuery.ASTNumberLiteral('2'))
      );
      assert.deepEqual(result, expected);
    });

    it('should parse nested if expressions', () => {
      const result = db.parse('if ($x) then if ($y) then 1 else 2 else 3').value
        .body[0];
      const expected = new astXQuery.IfExpr(
        wrapPath(new astXQuery.ASTVariable(new astXQuery.ASTName('x'))),
        new astXQuery.IfExpr(
          wrapPath(new astXQuery.ASTVariable(new astXQuery.ASTName('y'))),
          wrapPath(new astXQuery.ASTNumberLiteral('1')),
          wrapPath(new astXQuery.ASTNumberLiteral('2'))
        ),
        wrapPath(new astXQuery.ASTNumberLiteral('3'))
      );
      assert.deepEqual(result, expected);
    });
  });

  it('should parse numbers', () => {
    for (const [original, expected] of [
      ['1', 1],
      ['1.2', 1.2],
      ['1.2e2', 1.2e2],
    ]) {
      const result = db.parse(`${original}`).value.body;
      assert.deepEqual(
        (result[0].steps[0] as astXQuery.ASTNumberLiteral).value,
        expected
      );
    }
  });

  it('should parse strings', () => {
    for (const [original, expected] of [
      ["'hello'", 'hello'],
      ["'hel''lo'", "hel'lo"],
      ['"hello"', 'hello'],
      ['"hel""lo"', 'hel"lo'],
    ]) {
      const result = db.parse(`${original}`).value.body;
      assert.deepEqual(
        (result[0].steps[0] as astXQuery.ASTStringLiteral).value,
        expected
      );
    }
  });

  describe('comments', () => {
    it('should ignore block comments', () => {
      const result = db.parse('(: com (: 3 :) \nment :)1').value.body;
      assert.deepEqual(result, [wrapPath(new astXQuery.ASTNumberLiteral('1'))]);
    });
  });
});
