import { ASTNode, ASTOperator, DortDB } from '@dortdb/core';
import { XQuery } from '../../src/index.js';
import * as astXQuery from '../../src/ast/index.js';

describe('Grammar hacks', () => {
  const db = new DortDB({
    mainLang: XQuery(),
    optimizer: { rules: [] },
  });
  const getExpr = (query: string) =>
    (db.parse(query)[0] as astXQuery.Module).body[0];
  // see https://www.w3.org/TR/2014/REC-xquery-30-20140408/#extra-grammatical-constraints - the grammar from the spec itself is hacky

  it('should parse lone slash path', () => {
    const result = getExpr('/ + /a');
    const expected = new ASTOperator(
      'xquery',
      new astXQuery.XQueryIdentifier('+'),
      [
        new astXQuery.PathExpr([], '/'),
        new astXQuery.PathExpr(
          [
            new astXQuery.PathAxis(
              astXQuery.AxisType.CHILD,
              new astXQuery.ASTItemType(
                null,
                new astXQuery.XQueryIdentifier('a'),
              ),
            ),
          ],
          '/',
        ),
      ],
    );
    expect(result).toEqual(expected);
  });

  it('should parse ambiguous tokens as a path', () => {
    for (const [token, step] of [
      [
        '*',
        new astXQuery.PathAxis(
          astXQuery.AxisType.CHILD,
          new astXQuery.ASTItemType(null, '*'),
        ),
      ],
      [
        '<a />',
        new astXQuery.DirectElementConstructor(
          new astXQuery.XQueryIdentifier('a'),
          [],
        ),
      ],
    ] as const) {
      const result = getExpr(`/ ${token} /a`);
      const expected = new astXQuery.PathExpr(
        [
          step,
          new astXQuery.PathAxis(
            astXQuery.AxisType.CHILD,
            new astXQuery.ASTItemType(
              null,
              new astXQuery.XQueryIdentifier('a'),
            ),
          ),
        ],
        '/',
      );
      expect(result).toEqual(expected);
    }
  });

  it('should prefer sequence type over operator', () => {
    for (const [token, occ] of [
      ['+', astXQuery.Occurence.ONE_OR_MORE],
      ['*', astXQuery.Occurence.ZERO_OR_MORE],
    ] as const) {
      const result = getExpr(`4 instance of item()${token} - 5`);
      const expected = new ASTOperator(
        'xquery',
        new astXQuery.XQueryIdentifier('-'),
        [
          new astXQuery.InstanceOfExpr(
            new astXQuery.ASTNumberLiteral('4'),
            new astXQuery.ASTSequenceType(
              new astXQuery.ASTItemType(astXQuery.ItemKind.ITEM),
              occ,
            ),
          ),
          new astXQuery.ASTNumberLiteral('5'),
        ],
      );
      expect(result).toEqual(expected);
    }
  });
});
