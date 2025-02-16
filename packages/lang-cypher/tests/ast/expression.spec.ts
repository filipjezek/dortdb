import { ASTFunction, ASTNode, DortDB } from '@dortdb/core';
import { Cypher } from '../../src/index.js';
import * as astCypher from '../../src/ast/index.js';
import { ASTOperator } from '@dortdb/core';

describe('AST Expressions', () => {
  const db = new DortDB({
    mainLang: Cypher,
  });
  const getRet = (input: string): ASTNode =>
    (
      (db.parse(input).value[0] as astCypher.Query)
        .statements[0] as astCypher.ReturnClause
    ).body.items[0] as ASTNode;

  describe('operators', () => {
    it('should preserve operator precedence', () => {
      const result = getRet('RETURN 1 + 2 * 3 - 5 / 8 ^ foo.bar.baz < 3');
      const expected = new ASTOperator(
        'cypher',
        new astCypher.CypherIdentifier('<'),
        [
          new ASTOperator('cypher', new astCypher.CypherIdentifier('-'), [
            new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
              new astCypher.ASTNumberLiteral('1'),
              new ASTOperator('cypher', new astCypher.CypherIdentifier('*'), [
                new astCypher.ASTNumberLiteral('2'),
                new astCypher.ASTNumberLiteral('3'),
              ]),
            ]),
            new ASTOperator('cypher', new astCypher.CypherIdentifier('/'), [
              new astCypher.ASTNumberLiteral('5'),
              new ASTOperator('cypher', new astCypher.CypherIdentifier('^'), [
                new astCypher.ASTNumberLiteral('8'),
                new astCypher.PropLookup(
                  new astCypher.PropLookup(
                    new astCypher.CypherIdentifier('foo'),
                    new astCypher.CypherIdentifier('bar'),
                  ),
                  new astCypher.CypherIdentifier('baz'),
                ),
              ]),
            ]),
          ]),
          new astCypher.ASTNumberLiteral('3'),
        ],
      );
      expect(result).toEqual(expected);
    });

    it('should preserve associativity', () => {
      const result = getRet('RETURN 1 - 2 - 3');
      const expected = new ASTOperator(
        'cypher',
        new astCypher.CypherIdentifier('-'),
        [
          new ASTOperator('cypher', new astCypher.CypherIdentifier('-'), [
            new astCypher.ASTNumberLiteral('1'),
            new astCypher.ASTNumberLiteral('2'),
          ]),
          new astCypher.ASTNumberLiteral('3'),
        ],
      );
      expect(result).toEqual(expected);
    });

    it('should parse unary operators', () => {
      const result = getRet('RETURN -1 + +2');
      const expected = new ASTOperator(
        'cypher',
        new astCypher.CypherIdentifier('+'),
        [
          new ASTOperator('cypher', new astCypher.CypherIdentifier('-'), [
            new astCypher.ASTNumberLiteral('1'),
          ]),
          new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
            new astCypher.ASTNumberLiteral('2'),
          ]),
        ],
      );
      expect(result).toEqual(expected);
    });

    it('should parse compop chains', () => {
      const result = getRet('RETURN 3 + 1 < 2 > 0 - 2');
      const expected = new ASTOperator(
        'cypher',
        new astCypher.CypherIdentifier('and'),
        [
          new ASTOperator('cypher', new astCypher.CypherIdentifier('<'), [
            new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
              new astCypher.ASTNumberLiteral('3'),
              new astCypher.ASTNumberLiteral('1'),
            ]),
            new astCypher.ASTNumberLiteral('2'),
          ]),
          new ASTOperator('cypher', new astCypher.CypherIdentifier('>'), [
            new astCypher.ASTNumberLiteral('2'),
            new ASTOperator('cypher', new astCypher.CypherIdentifier('-'), [
              new astCypher.ASTNumberLiteral('0'),
              new astCypher.ASTNumberLiteral('2'),
            ]),
          ]),
        ],
      );
      expect(result).toEqual(expected);
    });
  });

  describe('function calls', () => {
    it('should parse function calls', () => {
      const result = getRet('RETURN foo(1, 2)');
      const expected = new astCypher.FnCallWrapper(
        new ASTFunction('cypher', new astCypher.CypherIdentifier('foo'), [
          new astCypher.ASTNumberLiteral('1'),
          new astCypher.ASTNumberLiteral('2'),
        ]),
        false,
      );
      expect(result).toEqual(expected);
    });

    it('should parse distinct function calls', () => {
      const result = getRet('RETURN foo(DISTINCT 1, 2)');
      const expected = new astCypher.FnCallWrapper(
        new ASTFunction('cypher', new astCypher.CypherIdentifier('foo'), [
          new astCypher.ASTNumberLiteral('1'),
          new astCypher.ASTNumberLiteral('2'),
        ]),
        true,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('quantified queries', () => {
    it('should parse quantified queries', () => {
      const result = getRet('RETURN ALL (x IN 1)');
      const expected = new astCypher.QuantifiedExpr(
        'all',
        new astCypher.CypherIdentifier('x'),
        new astCypher.ASTNumberLiteral('1'),
      );
      expect(result).toEqual(expected);
    });

    it('should parse quantified queries with where', () => {
      const result = getRet('RETURN ALL (x IN 1 WHERE x > 2)');
      const expected = new astCypher.QuantifiedExpr(
        'all',
        new astCypher.CypherIdentifier('x'),
        new astCypher.ASTNumberLiteral('1'),
        new ASTOperator('cypher', new astCypher.CypherIdentifier('>'), [
          new astCypher.CypherIdentifier('x'),
          new astCypher.ASTNumberLiteral('2'),
        ]),
      );
      expect(result).toEqual(expected);
    });
  });

  describe('case expressions', () => {
    it('should parse if-else style expressions', () => {
      const result = getRet(
        'RETURN CASE WHEN 1 THEN 2 WHEN 3 THEN 4 ELSE 5 END',
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
        new astCypher.ASTNumberLiteral('5'),
      );
      expect(result).toEqual(expected);
    });
    it('should parse switch style expressions', () => {
      const result = getRet(
        'RETURN CASE a WHEN 1 THEN 2 WHEN 3 THEN 4 ELSE 5 END',
      );
      const expected = new astCypher.CaseExpr(
        new astCypher.CypherIdentifier('a'),
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
        new astCypher.ASTNumberLiteral('5'),
      );
      expect(result).toEqual(expected);
    });
  });

  describe('comprehension', () => {
    it('should parse list comprehensions', () => {
      const result = getRet('RETURN [x IN a WHERE b]');
      const expected = new astCypher.ListComprehension(
        new astCypher.CypherIdentifier('x'),
        new astCypher.CypherIdentifier('a'),
        new astCypher.CypherIdentifier('b'),
      );
      expect(result).toEqual(expected);
    });

    it('should parse list comprehensions with mapping', () => {
      const result = getRet('RETURN [x IN a | x + 1]');
      const expected = new astCypher.ListComprehension(
        new astCypher.CypherIdentifier('x'),
        new astCypher.CypherIdentifier('a'),
        undefined,
        new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
          new astCypher.CypherIdentifier('x'),
          new astCypher.ASTNumberLiteral('1'),
        ]),
      );
      expect(result).toEqual(expected);
    });

    it('should parse list comprehensions with mapping and filter', () => {
      const result = getRet('RETURN [x IN a WHERE b | x + 1]');
      const expected = new astCypher.ListComprehension(
        new astCypher.CypherIdentifier('x'),
        new astCypher.CypherIdentifier('a'),
        new astCypher.CypherIdentifier('b'),
        new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
          new astCypher.CypherIdentifier('x'),
          new astCypher.ASTNumberLiteral('1'),
        ]),
      );
      expect(result).toEqual(expected);
    });

    it('should parse pattern comprehensions', () => {
      const result = getRet('RETURN [(a) WHERE b | x + 1]');
      const expected = new astCypher.PatternComprehension(
        new astCypher.PatternElChain(
          new astCypher.NodePattern(new astCypher.CypherIdentifier('a')),
        ),
        new astCypher.CypherIdentifier('b'),
        new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
          new astCypher.CypherIdentifier('x'),
          new astCypher.ASTNumberLiteral('1'),
        ]),
      );
      expect(result).toEqual(expected);
    });

    it('should parse pattern comprehensions with variable', () => {
      const result = getRet('RETURN [foo = (a) WHERE b | x + 1]');
      const expected = new astCypher.PatternComprehension(
        new astCypher.PatternElChain(
          new astCypher.NodePattern(new astCypher.CypherIdentifier('a')),
        ),
        new astCypher.CypherIdentifier('b'),
        new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
          new astCypher.CypherIdentifier('x'),
          new astCypher.ASTNumberLiteral('1'),
        ]),
      );
      expected.pattern.variable = new astCypher.CypherIdentifier('foo');
      expect(result).toEqual(expected);
    });

    it('should parse pattern comprehensions without filter', () => {
      const result = getRet('RETURN [(a) | x + 1]');
      const expected = new astCypher.PatternComprehension(
        new astCypher.PatternElChain(
          new astCypher.NodePattern(new astCypher.CypherIdentifier('a')),
        ),
        undefined,
        new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
          new astCypher.CypherIdentifier('x'),
          new astCypher.ASTNumberLiteral('1'),
        ]),
      );
      expect(result).toEqual(expected);
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
        expect((result as astCypher.ASTNumberLiteral).value).toEqual(expected);
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
        expect((result as astCypher.ASTStringLiteral).value).toEqual(expected);
      }
    });

    it('should parse booleans', () => {
      for (const [original, expected] of [
        ['true', true],
        ['false', false],
        ['null', null],
      ]) {
        const result = getRet(`RETURN ${original}`);
        expect((result as astCypher.ASTBooleanLiteral).value).toEqual(expected);
      }
    });

    it('should parse lists', () => {
      const result = getRet('RETURN [1, 2 + 1, 3]');
      const expected = new astCypher.ASTListLiteral([
        new astCypher.ASTNumberLiteral('1'),
        new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
          new astCypher.ASTNumberLiteral('2'),
          new astCypher.ASTNumberLiteral('1'),
        ]),
        new astCypher.ASTNumberLiteral('3'),
      ]);
      expect(result).toEqual(expected);
    });

    it('should parse maps', () => {
      const result = getRet('RETURN {a: 1, b: 2 + 1, c: 3}');
      const expected = new astCypher.ASTMapLiteral([
        [
          new astCypher.CypherIdentifier('a'),
          new astCypher.ASTNumberLiteral('1'),
        ],
        [
          new astCypher.CypherIdentifier('b'),
          new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
            new astCypher.ASTNumberLiteral('2'),
            new astCypher.ASTNumberLiteral('1'),
          ]),
        ],
        [
          new astCypher.CypherIdentifier('c'),
          new astCypher.ASTNumberLiteral('3'),
        ],
      ]);
      expect(result).toEqual(expected);
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
        new astCypher.CypherIdentifier('+'),
        [
          new astCypher.ASTNumberLiteral('1'),
          new astCypher.ASTNumberLiteral('4'),
        ],
      );
      expect(result).toEqual(expected);
    });

    it('should ignore block comments', () => {
      const result = getRet('RETURN /* com /* 3 */ \nment */1');
      expect(result).toEqual(new astCypher.ASTNumberLiteral('1'));
    });
  });
});
