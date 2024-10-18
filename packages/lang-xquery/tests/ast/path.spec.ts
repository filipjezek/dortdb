import { describe, it } from 'node:test';
import { XQuery } from '../../src/index.js';
import assert from 'node:assert/strict';
import * as astXQuery from '../../src/ast/index.js';
import { ASTNode, ASTOperator, DortDB } from '@dortdb/core';

describe('AST paths', () => {
  const db = new DortDB({
    mainLang: XQuery,
  });
  const wrapChild = (
    name: astXQuery.ASTName | '*',
    predicates: astXQuery.PathPredicate[] = []
  ) => {
    const t = new astXQuery.PathAxis(
      astXQuery.AxisType.CHILD,
      new astXQuery.ASTItemType(null, name)
    );
    t.predicates = predicates;
    return t;
  };
  const wrapPath = (lit: ASTNode) => new astXQuery.PathExpr([lit]);

  it('should parse paths', () => {
    const result = db.parse('$x/y/z').value.body;
    const expected = [
      new astXQuery.PathExpr([
        new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
        wrapChild(new astXQuery.ASTName('y')),
        wrapChild(new astXQuery.ASTName('z')),
      ]),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse paths with predicates', () => {
    const result = db.parse('$x/a[1][2]').value.body;
    const expected = [
      new astXQuery.PathExpr([
        new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
        wrapChild(new astXQuery.ASTName('a'), [
          new astXQuery.PathPredicate([
            wrapPath(new astXQuery.ASTNumberLiteral('1')),
          ]),
          new astXQuery.PathPredicate([
            wrapPath(new astXQuery.ASTNumberLiteral('2')),
          ]),
        ]),
      ]),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse paths with filter expressions', () => {
    const result = db.parse('$book[0]/(chapter | appendix)[1]').value.body[0];
    const expected = new astXQuery.PathExpr([
      new astXQuery.FilterExpr(
        new astXQuery.ASTVariable(new astXQuery.ASTName('book')),
        new astXQuery.PathPredicate([
          wrapPath(new astXQuery.ASTNumberLiteral('0')),
        ])
      ),
      new astXQuery.FilterExpr(
        new ASTOperator('xquery', new astXQuery.ASTName('|'), [
          wrapPath(new astXQuery.ASTName('chapter')),
          wrapPath(new astXQuery.ASTName('appendix')),
        ]),
        new astXQuery.PathPredicate([
          wrapPath(new astXQuery.ASTNumberLiteral('1')),
        ])
      ),
    ]);
    assert.deepEqual(result, expected);
  });

  it('should parse paths with axis', () => {
    const result = db.parse('$x/following-sibling::y').value.body;
    const expected = [
      new astXQuery.PathExpr([
        new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
        new astXQuery.PathAxis(
          astXQuery.AxisType.FOLLOWING_SIBLING,
          new astXQuery.ASTItemType(null, new astXQuery.ASTName('y'))
        ),
      ]),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse paths with axis and node test', () => {
    const result = db.parse('$x/following-sibling::attribute()').value.body;
    const expected = [
      new astXQuery.PathExpr([
        new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
        new astXQuery.PathAxis(
          astXQuery.AxisType.FOLLOWING_SIBLING,
          new astXQuery.ASTItemType(astXQuery.ItemKind.ATTRIBUTE)
        ),
      ]),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse descendant-or-self shortcut', () => {
    const result = db.parse('$x//y').value.body;
    const expected = [
      new astXQuery.PathExpr([
        new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
        new astXQuery.PathAxis(
          astXQuery.AxisType.DESCENDANT_OR_SELF,
          new astXQuery.ASTItemType(astXQuery.ItemKind.NODE)
        ),
        wrapChild(new astXQuery.ASTName('y')),
      ]),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse parent shortcut', () => {
    const result = db.parse('$x/../y').value.body;
    const expected = [
      new astXQuery.PathExpr([
        new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
        new astXQuery.PathAxis(
          astXQuery.AxisType.PARENT,
          new astXQuery.ASTItemType(astXQuery.ItemKind.NODE)
        ),
        wrapChild(new astXQuery.ASTName('y')),
      ]),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse attribute shortcut', () => {
    const result = db.parse('$x/@y').value.body;
    const expected = [
      new astXQuery.PathExpr([
        new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
        new astXQuery.PathAxis(
          astXQuery.AxisType.ATTRIBUTE,
          new astXQuery.ASTItemType(null, new astXQuery.ASTName('y'))
        ),
      ]),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse any element wildcard', () => {
    const result = db.parse('$x/*').value.body;
    const expected = [
      new astXQuery.PathExpr([
        new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
        new astXQuery.PathAxis(
          astXQuery.AxisType.CHILD,
          new astXQuery.ASTItemType(null, '*')
        ),
      ]),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse absolute paths', () => {
    const result = db.parse('/x/y, //x/y').value.body;
    const expected = [
      new astXQuery.PathExpr(
        [
          wrapChild(new astXQuery.ASTName('x')),
          wrapChild(new astXQuery.ASTName('y')),
        ],
        '/'
      ),
      new astXQuery.PathExpr(
        [
          wrapChild(new astXQuery.ASTName('x')),
          wrapChild(new astXQuery.ASTName('y')),
        ],
        '//'
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse paths with current-item step', () => {
    const result = db.parse('$x/./y').value.body;
    const expected = [
      new astXQuery.PathExpr([
        new astXQuery.ASTVariable(new astXQuery.ASTName('x')),
        new astXQuery.CurrentItemRef(),
        wrapChild(new astXQuery.ASTName('y')),
      ]),
    ];
    assert.deepEqual(result, expected);
  });
});
