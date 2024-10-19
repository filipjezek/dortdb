import { ASTNode, ASTOperator, DortDB } from '@dortdb/core';
import { describe, it } from 'node:test';
import { XQuery } from '../../src';
import * as astXQuery from '../../src/ast';
import assert from 'node:assert/strict';

describe('Grammar hacks', () => {
  const db = new DortDB({
    mainLang: XQuery,
  });
  const wrapPath = (lit: ASTNode) => new astXQuery.PathExpr([lit]);
  // see https://www.w3.org/TR/2014/REC-xquery-30-20140408/#extra-grammatical-constraints - the grammar from the spec itself is hacky

  it('should parse lone slash path', () => {
    const result = db.parse('/ + /a').value.body;
    const expected = [
      new ASTOperator('xquery', new astXQuery.ASTName('+'), [
        new astXQuery.PathExpr([], '/'),
        new astXQuery.PathExpr(
          [
            new astXQuery.PathAxis(
              astXQuery.AxisType.CHILD,
              new astXQuery.ASTItemType(null, new astXQuery.ASTName('a'))
            ),
          ],
          '/'
        ),
      ]),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse ambiguous tokens as a path', () => {
    for (const [token, step] of [
      [
        '*',
        new astXQuery.PathAxis(
          astXQuery.AxisType.CHILD,
          new astXQuery.ASTItemType(null, '*')
        ),
      ],
      [
        '<a />',
        new astXQuery.DirectElementConstructor(new astXQuery.ASTName('a'), []),
      ],
    ] as const) {
      const result = db.parse(`/ ${token} /a`).value.body;
      const expected = [
        new astXQuery.PathExpr(
          [
            step,
            new astXQuery.PathAxis(
              astXQuery.AxisType.CHILD,
              new astXQuery.ASTItemType(null, new astXQuery.ASTName('a'))
            ),
          ],
          '/'
        ),
      ];
      assert.deepEqual(result, expected);
    }
  });

  it('should prefer sequence type over operator', () => {
    for (const [token, occ] of [
      ['+', astXQuery.Occurence.ONE_OR_MORE],
      ['*', astXQuery.Occurence.ZERO_OR_MORE],
    ] as const) {
      const result = db.parse(`4 instance of item() ${token} - 5`).value.body;
      const expected = [
        new ASTOperator('xquery', new astXQuery.ASTName('-'), [
          new astXQuery.InstanceOfExpr(
            wrapPath(new astXQuery.ASTNumberLiteral('4')),
            new astXQuery.ASTSequenceType(
              new astXQuery.ASTItemType(astXQuery.ItemKind.ITEM),
              occ
            )
          ),
          wrapPath(new astXQuery.ASTNumberLiteral('5')),
        ]),
      ];
      assert.deepEqual(result, expected);
    }
  });
});
