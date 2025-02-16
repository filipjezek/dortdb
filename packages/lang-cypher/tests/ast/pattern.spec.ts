import { ASTNode, DortDB } from '@dortdb/core';
import { Cypher } from '../../src/index.js';
import * as astCypher from '../../src/ast/index.js';

describe('AST patterns', () => {
  const db = new DortDB({
    mainLang: Cypher,
  });
  const getRet = (input: string): ASTNode =>
    (
      (db.parse(input).value[0] as astCypher.Query)
        .statements[0] as astCypher.ReturnClause
    ).body.items[0] as ASTNode;

  it('should parse parenthesized variable as a pattern', () => {
    const result = getRet('RETURN (a)');
    const expected = new astCypher.PatternElChain([
      new astCypher.NodePattern(new astCypher.CypherIdentifier('a')),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse parenthesized map literal as a pattern', () => {
    const result = getRet('RETURN ({a: 1})');
    const expected = new astCypher.PatternElChain([
      new astCypher.NodePattern(
        undefined,
        [],
        new astCypher.ASTMapLiteral([
          [
            new astCypher.CypherIdentifier('a'),
            new astCypher.ASTNumberLiteral('1'),
          ],
        ]),
      ),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse parenthesized parameter as a pattern', () => {
    const result = getRet('RETURN ($1)');
    const expected = new astCypher.PatternElChain([
      new astCypher.NodePattern(
        undefined,
        [],
        new astCypher.ASTParameter('$1'),
      ),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse a complicated pattern chain', () => {
    const result = getRet(
      'RETURN (a)-[:REL]->(b:bar)<-[{foo: 1}]-(:baz:gaz)<-->({foo: 2})--(c:qux $1)<--(d)-->(e)-[c:x|:y {foo: 3}]-(f)<-[:z*2]->(g)-[:z*{foo: 4}]->(h)-[:z*2..4]->(i)',
    );
    const expected = new astCypher.PatternElChain([
      new astCypher.NodePattern(new astCypher.CypherIdentifier('a')),
      new astCypher.RelPattern(false, true, undefined, [
        new astCypher.CypherIdentifier('REL'),
      ]),
      new astCypher.NodePattern(new astCypher.CypherIdentifier('b'), [
        new astCypher.CypherIdentifier('bar'),
      ]),
      new astCypher.RelPattern(
        true,
        false,
        undefined,
        [],
        undefined,
        new astCypher.ASTMapLiteral([
          [
            new astCypher.CypherIdentifier('foo'),
            new astCypher.ASTNumberLiteral('1'),
          ],
        ]),
      ),
      new astCypher.NodePattern(undefined, [
        new astCypher.CypherIdentifier('baz'),
        new astCypher.CypherIdentifier('gaz'),
      ]),
      new astCypher.RelPattern(true, true),
      new astCypher.NodePattern(
        undefined,
        [],
        new astCypher.ASTMapLiteral([
          [
            new astCypher.CypherIdentifier('foo'),
            new astCypher.ASTNumberLiteral('2'),
          ],
        ]),
      ),
      new astCypher.RelPattern(false, false),
      new astCypher.NodePattern(
        new astCypher.CypherIdentifier('c'),
        [new astCypher.CypherIdentifier('qux')],
        new astCypher.ASTParameter('$1'),
      ),
      new astCypher.RelPattern(true, false),
      new astCypher.NodePattern(new astCypher.CypherIdentifier('d')),
      new astCypher.RelPattern(false, true),
      new astCypher.NodePattern(new astCypher.CypherIdentifier('e')),
      new astCypher.RelPattern(
        false,
        false,
        new astCypher.CypherIdentifier('c'),
        [
          new astCypher.CypherIdentifier('x'),
          new astCypher.CypherIdentifier('y'),
        ],
        undefined,
        new astCypher.ASTMapLiteral([
          [
            new astCypher.CypherIdentifier('foo'),
            new astCypher.ASTNumberLiteral('3'),
          ],
        ]),
      ),
      new astCypher.NodePattern(new astCypher.CypherIdentifier('f')),
      new astCypher.RelPattern(
        true,
        true,
        undefined,
        [new astCypher.CypherIdentifier('z')],
        [new astCypher.ASTNumberLiteral('2')],
      ),
      new astCypher.NodePattern(new astCypher.CypherIdentifier('g')),
      new astCypher.RelPattern(
        false,
        true,
        undefined,
        [new astCypher.CypherIdentifier('z')],
        [undefined],
        new astCypher.ASTMapLiteral([
          [
            new astCypher.CypherIdentifier('foo'),
            new astCypher.ASTNumberLiteral('4'),
          ],
        ]),
      ),
      new astCypher.NodePattern(new astCypher.CypherIdentifier('h')),
      new astCypher.RelPattern(
        false,
        true,
        undefined,
        [new astCypher.CypherIdentifier('z')],
        [
          new astCypher.ASTNumberLiteral('2'),
          new astCypher.ASTNumberLiteral('4'),
        ],
      ),
      new astCypher.NodePattern(new astCypher.CypherIdentifier('i')),
    ]);
    expect(result).toEqual(expected);
  });
});
