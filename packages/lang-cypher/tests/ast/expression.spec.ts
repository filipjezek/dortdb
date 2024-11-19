import { describe, it } from 'node:test';
import { ASTFunction, ASTNode, DortDB } from '@dortdb/core';
import { Cypher } from '../../src/index.js';
import assert from 'node:assert/strict';
import * as astCypher from '../../src/ast/index.js';
import { ASTOperator } from '@dortdb/core';

describe('AST Expressions', () => {
  const db = new DortDB({
    mainLang: Cypher,
  });
  const getRet = (input: string): ASTNode =>
    db.parse(input).value.statements[0].body.items[0];

  describe('operators', () => {
    it('should preserve operator precedence', () => {
      const result = getRet('RETURN 1 + 2 * 3 - 5 / 8 ^ foo.bar.baz < 3');
      const expected = new ASTOperator(
        'cypher',
        new astCypher.ASTIdentifier('<'),
        [
          new ASTOperator('cypher', new astCypher.ASTIdentifier('-'), [
            new ASTOperator('cypher', new astCypher.ASTIdentifier('+'), [
              new astCypher.ASTNumberLiteral('1'),
              new ASTOperator('cypher', new astCypher.ASTIdentifier('*'), [
                new astCypher.ASTNumberLiteral('2'),
                new astCypher.ASTNumberLiteral('3'),
              ]),
            ]),
            new ASTOperator('cypher', new astCypher.ASTIdentifier('/'), [
              new astCypher.ASTNumberLiteral('5'),
              new ASTOperator('cypher', new astCypher.ASTIdentifier('^'), [
                new astCypher.ASTNumberLiteral('8'),
                new astCypher.PropLookup(
                  new astCypher.PropLookup(
                    new astCypher.ASTIdentifier('foo'),
                    new astCypher.ASTIdentifier('bar')
                  ),
                  new astCypher.ASTIdentifier('baz')
                ),
              ]),
            ]),
          ]),
          new astCypher.ASTNumberLiteral('3'),
        ]
      );
      assert.deepEqual(result, expected);
    });

    it('should preserve associativity', () => {
      const result = getRet('RETURN 1 - 2 - 3');
      const expected = new ASTOperator(
        'cypher',
        new astCypher.ASTIdentifier('-'),
        [
          new ASTOperator('cypher', new astCypher.ASTIdentifier('-'), [
            new astCypher.ASTNumberLiteral('1'),
            new astCypher.ASTNumberLiteral('2'),
          ]),
          new astCypher.ASTNumberLiteral('3'),
        ]
      );
      assert.deepEqual(result, expected);
    });

    it('should parse unary operators', () => {
      const result = getRet('RETURN -1 + +2');
      const expected = new ASTOperator(
        'cypher',
        new astCypher.ASTIdentifier('+'),
        [
          new ASTOperator('cypher', new astCypher.ASTIdentifier('-'), [
            new astCypher.ASTNumberLiteral('1'),
          ]),
          new ASTOperator('cypher', new astCypher.ASTIdentifier('+'), [
            new astCypher.ASTNumberLiteral('2'),
          ]),
        ]
      );
      assert.deepEqual(result, expected);
    });

    it('should parse compop chains', () => {
      const result = getRet('RETURN 3 + 1 < 2 > 0 - 2');
      const expected = new ASTOperator(
        'cypher',
        new astCypher.ASTIdentifier('and'),
        [
          new ASTOperator('cypher', new astCypher.ASTIdentifier('<'), [
            new ASTOperator('cypher', new astCypher.ASTIdentifier('+'), [
              new astCypher.ASTNumberLiteral('3'),
              new astCypher.ASTNumberLiteral('1'),
            ]),
            new astCypher.ASTNumberLiteral('2'),
          ]),
          new ASTOperator('cypher', new astCypher.ASTIdentifier('>'), [
            new astCypher.ASTNumberLiteral('2'),
            new ASTOperator('cypher', new astCypher.ASTIdentifier('-'), [
              new astCypher.ASTNumberLiteral('0'),
              new astCypher.ASTNumberLiteral('2'),
            ]),
          ]),
        ]
      );
      assert.deepEqual(result, expected);
    });
  });

  describe('function calls', () => {
    it('should parse function calls', () => {
      const result = getRet('RETURN foo(1, 2)');
      const expected = new astCypher.FnCallWrapper(
        new ASTFunction('cypher', new astCypher.ASTIdentifier('foo'), [
          new astCypher.ASTNumberLiteral('1'),
          new astCypher.ASTNumberLiteral('2'),
        ]),
        false
      );
      assert.deepEqual(result, expected);
    });

    it('should parse distinct function calls', () => {
      const result = getRet('RETURN foo(DISTINCT 1, 2)');
      const expected = new astCypher.FnCallWrapper(
        new ASTFunction('cypher', new astCypher.ASTIdentifier('foo'), [
          new astCypher.ASTNumberLiteral('1'),
          new astCypher.ASTNumberLiteral('2'),
        ]),
        true
      );
      assert.deepEqual(result, expected);
    });
  });

  describe('quantified queries', () => {
    it('should parse quantified queries', () => {
      const result = getRet('RETURN ALL (x IN 1)');
      const expected = new astCypher.QuantifiedExpr(
        'all',
        new astCypher.ASTIdentifier('x'),
        new astCypher.ASTNumberLiteral('1')
      );
      assert.deepEqual(result, expected);
    });

    it('should parse quantified queries with where', () => {
      const result = getRet('RETURN ALL (x IN 1 WHERE x > 2)');
      const expected = new astCypher.QuantifiedExpr(
        'all',
        new astCypher.ASTIdentifier('x'),
        new astCypher.ASTNumberLiteral('1'),
        new ASTOperator('cypher', new astCypher.ASTIdentifier('>'), [
          new astCypher.ASTIdentifier('x'),
          new astCypher.ASTNumberLiteral('2'),
        ])
      );
      assert.deepEqual(result, expected);
    });
  });

  describe('case expressions', () => {
    it('should parse if-else style expressions', () => {
      const result = getRet(
        'RETURN CASE WHEN 1 THEN 2 WHEN 3 THEN 4 ELSE 5 END'
      );
      const expected = new astCypher.CaseExpr(
        undefined,
        [
          [
            new astCypher.ASTNumberLiteral('1'),
            new astCypher.ASTNumberLiteral('2'),
          ],
          [
            new astCypher.ASTNumberLiteral('3'),
            new astCypher.ASTNumberLiteral('4'),
          ],
        ],
        new astCypher.ASTNumberLiteral('5')
      );
      assert.deepEqual(result, expected);
    });
    it('should parse switch style expressions', () => {
      const result = getRet(
        'RETURN CASE a WHEN 1 THEN 2 WHEN 3 THEN 4 ELSE 5 END'
      );
      const expected = new astCypher.CaseExpr(
        new astCypher.ASTIdentifier('a'),
        [
          [
            new astCypher.ASTNumberLiteral('1'),
            new astCypher.ASTNumberLiteral('2'),
          ],
          [
            new astCypher.ASTNumberLiteral('3'),
            new astCypher.ASTNumberLiteral('4'),
          ],
        ],
        new astCypher.ASTNumberLiteral('5')
      );
      assert.deepEqual(result, expected);
    });
  });

  describe('comprehension', () => {
    it('should parse list comprehensions', () => {
      const result = getRet('RETURN [x IN a WHERE b]');
      const expected = new astCypher.ListComprehension(
        new astCypher.ASTIdentifier('x'),
        new astCypher.ASTIdentifier('a'),
        new astCypher.ASTIdentifier('b')
      );
      assert.deepEqual(result, expected);
    });

    it('should parse list comprehensions with mapping', () => {
      const result = getRet('RETURN [x IN a | x + 1]');
      const expected = new astCypher.ListComprehension(
        new astCypher.ASTIdentifier('x'),
        new astCypher.ASTIdentifier('a'),
        undefined,
        new ASTOperator('cypher', new astCypher.ASTIdentifier('+'), [
          new astCypher.ASTIdentifier('x'),
          new astCypher.ASTNumberLiteral('1'),
        ])
      );
      assert.deepEqual(result, expected);
    });

    it('should parse list comprehensions with mapping and filter', () => {
      const result = getRet('RETURN [x IN a WHERE b | x + 1]');
      const expected = new astCypher.ListComprehension(
        new astCypher.ASTIdentifier('x'),
        new astCypher.ASTIdentifier('a'),
        new astCypher.ASTIdentifier('b'),
        new ASTOperator('cypher', new astCypher.ASTIdentifier('+'), [
          new astCypher.ASTIdentifier('x'),
          new astCypher.ASTNumberLiteral('1'),
        ])
      );
      assert.deepEqual(result, expected);
    });

    it('should parse pattern comprehensions', () => {
      const result = getRet('RETURN [(a) WHERE b | x + 1]');
      const expected = new astCypher.PatternComprehension(
        new astCypher.PatternElChain(
          new astCypher.NodePattern(new astCypher.ASTIdentifier('a'))
        ),
        new astCypher.ASTIdentifier('b'),
        new ASTOperator('cypher', new astCypher.ASTIdentifier('+'), [
          new astCypher.ASTIdentifier('x'),
          new astCypher.ASTNumberLiteral('1'),
        ])
      );
      assert.deepEqual(result, expected);
    });

    it('should parse pattern comprehensions with variable', () => {
      const result = getRet('RETURN [foo = (a) WHERE b | x + 1]');
      const expected = new astCypher.PatternComprehension(
        new astCypher.PatternElChain(
          new astCypher.NodePattern(new astCypher.ASTIdentifier('a'))
        ),
        new astCypher.ASTIdentifier('b'),
        new ASTOperator('cypher', new astCypher.ASTIdentifier('+'), [
          new astCypher.ASTIdentifier('x'),
          new astCypher.ASTNumberLiteral('1'),
        ])
      );
      expected.pattern.variable = new astCypher.ASTIdentifier('foo');
      assert.deepEqual(result, expected);
    });

    it('should parse pattern comprehensions without filter', () => {
      const result = getRet('RETURN [(a) | x + 1]');
      const expected = new astCypher.PatternComprehension(
        new astCypher.PatternElChain(
          new astCypher.NodePattern(new astCypher.ASTIdentifier('a'))
        ),
        undefined,
        new ASTOperator('cypher', new astCypher.ASTIdentifier('+'), [
          new astCypher.ASTIdentifier('x'),
          new astCypher.ASTNumberLiteral('1'),
        ])
      );
      assert.deepEqual(result, expected);
    });
  });

  describe('literals', () => {
    it('should parse numbers', () => {
      for (const [original, expected] of [
        ['1', 1],
        ['1.2', 1.2],
        ['1.2e2', 1.2e2],
        ['0b1001', 9],
        ['0x1a', 26],
        ['0o10', 8],
      ]) {
        const result = getRet(`RETURN ${original}`);
        assert.deepEqual(
          (result as astCypher.ASTNumberLiteral).value,
          expected
        );
      }
    });

    it('should parse strings', () => {
      for (const [original, expected] of [
        ["'hello'", 'hello'],
        ["'hel\\'lo'", "hel'lo"],
        ['"hello"', 'hello'],
        ['"hel\\"lo"', 'hel"lo'],
        ["'he\\l\\n\\t\\x99\\u1234\\127lo'", 'he\\l\n\t\x99\u1234Wlo'],
      ]) {
        const result = getRet(`RETURN ${original}`);
        assert.deepEqual(
          (result as astCypher.ASTStringLiteral).value,
          expected
        );
      }
    });

    it('should parse booleans', () => {
      for (const [original, expected] of [
        ['true', true],
        ['false', false],
        ['null', null],
      ]) {
        const result = getRet(`RETURN ${original}`);
        assert.deepEqual(
          (result as astCypher.ASTBooleanLiteral).value,
          expected
        );
      }
    });

    it('should parse lists', () => {
      const result = getRet('RETURN [1, 2 + 1, 3]');
      const expected = new astCypher.ASTListLiteral([
        new astCypher.ASTNumberLiteral('1'),
        new ASTOperator('cypher', new astCypher.ASTIdentifier('+'), [
          new astCypher.ASTNumberLiteral('2'),
          new astCypher.ASTNumberLiteral('1'),
        ]),
        new astCypher.ASTNumberLiteral('3'),
      ]);
      assert.deepEqual(result, expected);
    });

    it('should parse maps', () => {
      const result = getRet('RETURN {a: 1, b: 2 + 1, c: 3}');
      const expected = new astCypher.ASTMapLiteral([
        [new astCypher.ASTIdentifier('a'), new astCypher.ASTNumberLiteral('1')],
        [
          new astCypher.ASTIdentifier('b'),
          new ASTOperator('cypher', new astCypher.ASTIdentifier('+'), [
            new astCypher.ASTNumberLiteral('2'),
            new astCypher.ASTNumberLiteral('1'),
          ]),
        ],
        [new astCypher.ASTIdentifier('c'), new astCypher.ASTNumberLiteral('3')],
      ]);
      assert.deepEqual(result, expected);
    });
  });

  describe('comments', () => {
    it('should ignore line comments', () => {
      const result = getRet(`
        RETURN 1 + // 2,
        // 3 +
        4`);
      const expected = new ASTOperator(
        'cypher',
        new astCypher.ASTIdentifier('+'),
        [
          new astCypher.ASTNumberLiteral('1'),
          new astCypher.ASTNumberLiteral('4'),
        ]
      );
      assert.deepEqual(result, expected);
    });

    it('should ignore block comments', () => {
      const result = getRet('RETURN /* com /* 3 */ \nment */1');
      assert.deepEqual(result, new astCypher.ASTNumberLiteral('1'));
    });
  });
});
