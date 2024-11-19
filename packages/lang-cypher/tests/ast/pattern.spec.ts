import { describe, it } from 'node:test';
import { ASTFunction, ASTNode, DortDB } from '@dortdb/core';
import { Cypher } from '../../src/index.js';
import assert from 'node:assert/strict';
import * as astCypher from '../../src/ast/index.js';
import { ASTOperator } from '@dortdb/core';

describe('AST patterns', () => {
  const db = new DortDB({
    mainLang: Cypher,
  });
  const getRet = (input: string): ASTNode =>
    db.parse(input).value.statements[0].body.items[0];

  it('should parse parenthesized variable as a pattern', () => {
    const result = getRet('RETURN (a)');
    const expected = new astCypher.PatternElChain([
      new astCypher.NodePattern(new astCypher.ASTIdentifier('a')),
    ]);
    assert.deepStrictEqual(result, expected);
  });

  it('should parse parenthesized map literal as a pattern', () => {
    const result = getRet('RETURN ({a: 1})');
    const expected = new astCypher.PatternElChain([
      new astCypher.NodePattern(
        undefined,
        [],
        new astCypher.ASTMapLiteral([
          [
            new astCypher.ASTIdentifier('a'),
            new astCypher.ASTNumberLiteral('1'),
          ],
        ])
      ),
    ]);
    assert.deepStrictEqual(result, expected);
  });

  it('should parse parenthesized parameter as a pattern', () => {
    const result = getRet('RETURN ($1)');
    const expected = new astCypher.PatternElChain([
      new astCypher.NodePattern(
        undefined,
        [],
        new astCypher.ASTParameter('$1')
      ),
    ]);
    assert.deepStrictEqual(result, expected);
  });

  it('should parse a complicated pattern chain', () => {
    const result = getRet(
      'RETURN (a)-[:REL]->(b:bar)<-[{foo: 1}]-(:baz:gaz)<-->({foo: 2})--(c:qux $1)<--(d)-->(e)-[c:x|:y {foo: 3}]-(f)<-[:z*2]->(g)-[:z*{foo: 4}]->(h)-[:z*2..4]->(i)'
    );
    const expected = new astCypher.PatternElChain([
      new astCypher.NodePattern(new astCypher.ASTIdentifier('a')),
      new astCypher.RelPattern(false, true, undefined, [
        new astCypher.ASTIdentifier('REL'),
      ]),
      new astCypher.NodePattern(new astCypher.ASTIdentifier('b'), [
        new astCypher.ASTIdentifier('bar'),
      ]),
      new astCypher.RelPattern(
        true,
        false,
        undefined,
        [],
        undefined,
        new astCypher.ASTMapLiteral([
          [
            new astCypher.ASTIdentifier('foo'),
            new astCypher.ASTNumberLiteral('1'),
          ],
        ])
      ),
      new astCypher.NodePattern(undefined, [
        new astCypher.ASTIdentifier('baz'),
        new astCypher.ASTIdentifier('gaz'),
      ]),
      new astCypher.RelPattern(true, true),
      new astCypher.NodePattern(
        undefined,
        [],
        new astCypher.ASTMapLiteral([
          [
            new astCypher.ASTIdentifier('foo'),
            new astCypher.ASTNumberLiteral('2'),
          ],
        ])
      ),
      new astCypher.RelPattern(false, false),
      new astCypher.NodePattern(
        new astCypher.ASTIdentifier('c'),
        [new astCypher.ASTIdentifier('qux')],
        new astCypher.ASTParameter('$1')
      ),
      new astCypher.RelPattern(true, false),
      new astCypher.NodePattern(new astCypher.ASTIdentifier('d')),
      new astCypher.RelPattern(false, true),
      new astCypher.NodePattern(new astCypher.ASTIdentifier('e')),
      new astCypher.RelPattern(
        false,
        false,
        new astCypher.ASTIdentifier('c'),
        [new astCypher.ASTIdentifier('x'), new astCypher.ASTIdentifier('y')],
        undefined,
        new astCypher.ASTMapLiteral([
          [
            new astCypher.ASTIdentifier('foo'),
            new astCypher.ASTNumberLiteral('3'),
          ],
        ])
      ),
      new astCypher.NodePattern(new astCypher.ASTIdentifier('f')),
      new astCypher.RelPattern(
        true,
        true,
        undefined,
        [new astCypher.ASTIdentifier('z')],
        [new astCypher.ASTNumberLiteral('2')]
      ),
      new astCypher.NodePattern(new astCypher.ASTIdentifier('g')),
      new astCypher.RelPattern(
        false,
        true,
        undefined,
        [new astCypher.ASTIdentifier('z')],
        [undefined],
        new astCypher.ASTMapLiteral([
          [
            new astCypher.ASTIdentifier('foo'),
            new astCypher.ASTNumberLiteral('4'),
          ],
        ])
      ),
      new astCypher.NodePattern(new astCypher.ASTIdentifier('h')),
      new astCypher.RelPattern(
        false,
        true,
        undefined,
        [new astCypher.ASTIdentifier('z')],
        [
          new astCypher.ASTNumberLiteral('2'),
          new astCypher.ASTNumberLiteral('4'),
        ]
      ),
      new astCypher.NodePattern(new astCypher.ASTIdentifier('i')),
    ]);
    assert.deepStrictEqual(result, expected);
  });
});
