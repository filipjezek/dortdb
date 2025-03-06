import { DOT, XQuery } from '../../src/index.js';
import * as astXQuery from '../../src/ast/index.js';
import { ASTNode, ASTOperator, DortDB } from '@dortdb/core';

describe('AST paths', () => {
  const db = new DortDB({
    mainLang: XQuery(),
  });
  const wrapChild = (
    name: astXQuery.XQueryIdentifier | '*',
    predicates: astXQuery.PathPredicate[] = [],
  ) => {
    const t = new astXQuery.PathAxis(
      astXQuery.AxisType.CHILD,
      new astXQuery.ASTItemType(null, name),
    );
    t.predicates = predicates;
    return t;
  };
  const wrapPath = (lit: ASTNode) => new astXQuery.PathExpr([lit]);
  const getExpr = (query: string) =>
    (db.parse(query).value[0] as astXQuery.Module).body[0];

  it('should parse paths', () => {
    const result = getExpr('$x/y/z');
    const expected = new astXQuery.PathExpr([
      new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
      wrapChild(new astXQuery.XQueryIdentifier('y')),
      wrapChild(new astXQuery.XQueryIdentifier('z')),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse paths with predicates', () => {
    const result = getExpr('$x/a[1][2]');
    const expected = new astXQuery.PathExpr([
      new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
      wrapChild(new astXQuery.XQueryIdentifier('a'), [
        new astXQuery.PathPredicate([new astXQuery.ASTNumberLiteral('1')]),
        new astXQuery.PathPredicate([new astXQuery.ASTNumberLiteral('2')]),
      ]),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse paths with filter expressions', () => {
    const result = getExpr('$book[0]/(chapter | appendix)[1]');
    const expected = new astXQuery.PathExpr([
      new astXQuery.FilterExpr(
        new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('book')),
        new astXQuery.PathPredicate([new astXQuery.ASTNumberLiteral('0')]),
      ),
      new astXQuery.FilterExpr(
        new ASTOperator('xquery', new astXQuery.XQueryIdentifier('|'), [
          wrapPath(wrapChild(new astXQuery.XQueryIdentifier('chapter'))),
          wrapPath(wrapChild(new astXQuery.XQueryIdentifier('appendix'))),
        ]),
        new astXQuery.PathPredicate([new astXQuery.ASTNumberLiteral('1')]),
      ),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse paths with axis', () => {
    const result = getExpr('$x/following-sibling::y');
    const expected = new astXQuery.PathExpr([
      new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
      new astXQuery.PathAxis(
        astXQuery.AxisType.FOLLOWING_SIBLING,
        new astXQuery.ASTItemType(null, new astXQuery.XQueryIdentifier('y')),
      ),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse paths with axis and node test', () => {
    const result = getExpr('$x/following-sibling::attribute()');
    const expected = new astXQuery.PathExpr([
      new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
      new astXQuery.PathAxis(
        astXQuery.AxisType.FOLLOWING_SIBLING,
        new astXQuery.ASTItemType(astXQuery.ItemKind.ATTRIBUTE),
      ),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse descendant-or-self shortcut', () => {
    const result = getExpr('$x//y');
    const expected = new astXQuery.PathExpr([
      new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
      new astXQuery.PathAxis(
        astXQuery.AxisType.DESCENDANT_OR_SELF,
        new astXQuery.ASTItemType(astXQuery.ItemKind.NODE),
      ),
      wrapChild(new astXQuery.XQueryIdentifier('y')),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse parent shortcut', () => {
    const result = getExpr('$x/../y');
    const expected = new astXQuery.PathExpr([
      new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
      new astXQuery.PathAxis(
        astXQuery.AxisType.PARENT,
        new astXQuery.ASTItemType(astXQuery.ItemKind.NODE),
      ),
      wrapChild(new astXQuery.XQueryIdentifier('y')),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse attribute shortcut', () => {
    const result = getExpr('$x/@y');
    const expected = new astXQuery.PathExpr([
      new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
      new astXQuery.PathAxis(
        astXQuery.AxisType.ATTRIBUTE,
        new astXQuery.ASTItemType(null, new astXQuery.XQueryIdentifier('y')),
      ),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse any element wildcard', () => {
    const result = getExpr('$x/*');
    const expected = new astXQuery.PathExpr([
      new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
      new astXQuery.PathAxis(
        astXQuery.AxisType.CHILD,
        new astXQuery.ASTItemType(null, '*'),
      ),
    ]);
    expect(result).toEqual(expected);
  });

  it('should parse absolute paths', () => {
    const result = getExpr('/x/y, //x/y');
    const expected = new astXQuery.PathExpr(
      [
        wrapChild(new astXQuery.XQueryIdentifier('x')),
        wrapChild(new astXQuery.XQueryIdentifier('y')),
      ],
      '/',
    );
    new astXQuery.PathExpr(
      [
        wrapChild(new astXQuery.XQueryIdentifier('x')),
        wrapChild(new astXQuery.XQueryIdentifier('y')),
      ],
      '//',
    );
    expect(result).toEqual(expected);
  });

  it('should parse paths with current-item step', () => {
    const result = getExpr('$x/./y');
    const expected = new astXQuery.PathExpr([
      new astXQuery.ASTVariable(new astXQuery.XQueryIdentifier('x')),
      DOT,
      wrapChild(new astXQuery.XQueryIdentifier('y')),
    ]);
    expect(result).toEqual(expected);
  });
});
