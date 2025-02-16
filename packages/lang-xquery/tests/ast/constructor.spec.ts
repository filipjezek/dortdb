import { XQuery } from '../../src/index.js';
import * as astXQuery from '../../src/ast/index.js';
import { DortDB } from '@dortdb/core';

describe('AST constructors', () => {
  const db = new DortDB({
    mainLang: XQuery,
  });
  const getExpr = (str: string) =>
    (db.parse(str).value[0] as astXQuery.Module).body[0];

  it('should parse self closing tags', () => {
    const result = getExpr('<foo/>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [],
    );
    expect(result).toEqual(expected);
  });

  it('should parse tags with no content', () => {
    const result = getExpr('<foo></foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [],
    );
    expect(result).toEqual(expected);
  });

  it('should parse tags with keyword names', () => {
    const result = getExpr('<item></item>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('item'),
      [],
    );
    expect(result).toEqual(expected);
  });

  it('should parse tags with attributes', () => {
    const result = getExpr('<foo bar="1" baz=\'x\'></foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [
        [
          new astXQuery.XQueryIdentifier('bar'),
          new astXQuery.DirConstrContent(['1']),
        ],
        [
          new astXQuery.XQueryIdentifier('baz'),
          new astXQuery.DirConstrContent(['x']),
        ],
      ],
    );
    expect(result).toEqual(expected);
  });

  it('should parse self closing tags with attributes', () => {
    const result = getExpr('<foo bar="1" baz=\'x\' />');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [
        [
          new astXQuery.XQueryIdentifier('bar'),
          new astXQuery.DirConstrContent(['1']),
        ],
        [
          new astXQuery.XQueryIdentifier('baz'),
          new astXQuery.DirConstrContent(['x']),
        ],
      ],
    );
    expect(result).toEqual(expected);
  });

  it('should parse tags with text content', () => {
    const result = getExpr('<foo>bar</foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [],
      ['bar'],
    );
    expect(result).toEqual(expected);
  });

  it('should parse tags with node content', () => {
    const result = getExpr('<foo><bar></bar><baz><cat /></baz></foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [],
      [
        new astXQuery.DirectElementConstructor(
          new astXQuery.XQueryIdentifier('bar'),
          [],
        ),
        new astXQuery.DirectElementConstructor(
          new astXQuery.XQueryIdentifier('baz'),
          [],
          [
            new astXQuery.DirectElementConstructor(
              new astXQuery.XQueryIdentifier('cat'),
              [],
            ),
          ],
        ),
      ],
    );
    expect(result).toEqual(expected);
  });

  it('should parse tags with mixed content', () => {
    const result = getExpr('<foo>bar<baz></baz>cat</foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [],
      [
        'bar',
        new astXQuery.DirectElementConstructor(
          new astXQuery.XQueryIdentifier('baz'),
          [],
        ),
        'cat',
      ],
    );
    expect(result).toEqual(expected);
  });

  it('should parse tags with comments', () => {
    const result = getExpr('<foo><!-- bar --></foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [],
      [new astXQuery.DirectCommentConstructor(' bar ')],
    );
    expect(result).toEqual(expected);
  });

  it('should parse tags with processing instructions', () => {
    const result = getExpr('<foo><?bar baz?></foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [],
      [new astXQuery.DirectPIConstructor('bar', 'baz')],
    );
    expect(result).toEqual(expected);
  });

  it('should parse processing instructions with no content', () => {
    const result = getExpr('<?foo?>');
    const expected = new astXQuery.DirectPIConstructor('foo');
    expect(result).toEqual(expected);
  });

  it('should parse tags with interpolated content', () => {
    const result = getExpr('<foo>a{1}</foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [],
      ['a', [new astXQuery.ASTNumberLiteral('1')]],
    );
    expect(result).toEqual(expected);
  });

  it('should parse tags with interpolated attributes', () => {
    const result = getExpr('<foo bar="{1}"></foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [
        [
          new astXQuery.XQueryIdentifier('bar'),
          new astXQuery.DirConstrContent([
            [new astXQuery.ASTNumberLiteral('1')],
          ]),
        ],
      ],
    );
    expect(result).toEqual(expected);
  });

  it('should parse nested interpolated content', () => {
    const result = getExpr('<foo>{<a>{2}</a>}</foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [],
      [
        [
          new astXQuery.DirectElementConstructor(
            new astXQuery.XQueryIdentifier('a'),
            [],
            [[new astXQuery.ASTNumberLiteral('2')]],
          ),
        ],
      ],
    );
    expect(result).toEqual(expected);
  });

  it('should parse empty attributes', () => {
    const result = getExpr('<foo bar=""></foo>');
    const expected = new astXQuery.DirectElementConstructor(
      new astXQuery.XQueryIdentifier('foo'),
      [
        [
          new astXQuery.XQueryIdentifier('bar'),
          new astXQuery.DirConstrContent([]),
        ],
      ],
    );
    expect(result).toEqual(expected);
  });

  it('should not allow mismatched tags', () => {
    expect(() => getExpr('<foo></bar>')).toThrow();
  });

  it('should not allow unclosed tags', () => {
    expect(() => getExpr('<foo>')).toThrow();
  });
});
