import { describe, it } from 'node:test';
import { XQuery } from '../../src/index.js';
import assert from 'node:assert/strict';
import * as astXQuery from '../../src/ast/index.js';
import { ASTNode, DortDB } from '@dortdb/core';

describe('AST constructors', () => {
  const db = new DortDB({
    mainLang: XQuery,
  });
  const wrapPath = (lit: ASTNode) => new astXQuery.PathExpr([lit]);

  it('should parse self closing tags', () => {
    const result = db.parse('<foo/>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(new astXQuery.ASTName('foo'), [])
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse tags with no content', () => {
    const result = db.parse('<foo></foo>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(new astXQuery.ASTName('foo'), [])
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse tags with attributes', () => {
    const result = db.parse('<foo bar="1" baz=\'x\'></foo>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(new astXQuery.ASTName('foo'), [
          [new astXQuery.ASTName('bar'), new astXQuery.DirConstrContent(['1'])],
          [new astXQuery.ASTName('baz'), new astXQuery.DirConstrContent(['x'])],
        ])
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse self closing tags with attributes', () => {
    const result = db.parse('<foo bar="1" baz=\'x\' />').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(new astXQuery.ASTName('foo'), [
          [new astXQuery.ASTName('bar'), new astXQuery.DirConstrContent(['1'])],
          [new astXQuery.ASTName('baz'), new astXQuery.DirConstrContent(['x'])],
        ])
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse tags with text content', () => {
    const result = db.parse('<foo>bar</foo>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(
          new astXQuery.ASTName('foo'),
          [],
          ['bar']
        )
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse tags with node content', () => {
    const result = db.parse('<foo><bar></bar><baz><cat /></baz></foo>').value
      .body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(
          new astXQuery.ASTName('foo'),
          [],
          [
            new astXQuery.DirectElementConstructor(
              new astXQuery.ASTName('bar'),
              []
            ),
            new astXQuery.DirectElementConstructor(
              new astXQuery.ASTName('baz'),
              [],
              [
                new astXQuery.DirectElementConstructor(
                  new astXQuery.ASTName('cat'),
                  []
                ),
              ]
            ),
          ]
        )
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse tags with mixed content', () => {
    const result = db.parse('<foo>bar<baz></baz>cat</foo>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(
          new astXQuery.ASTName('foo'),
          [],
          [
            'bar',
            new astXQuery.DirectElementConstructor(
              new astXQuery.ASTName('baz'),
              []
            ),
            'cat',
          ]
        )
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse tags with comments', () => {
    const result = db.parse('<foo><!-- bar --></foo>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(
          new astXQuery.ASTName('foo'),
          [],
          [new astXQuery.DirectCommentConstructor(' bar ')]
        )
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse tags with processing instructions', () => {
    const result = db.parse('<foo><?bar baz?></foo>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(
          new astXQuery.ASTName('foo'),
          [],
          [new astXQuery.DirectPIConstructor('bar', 'baz')]
        )
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse processing instructions with no content', () => {
    const result = db.parse('<?foo?>').value.body;
    const expected = [wrapPath(new astXQuery.DirectPIConstructor('foo'))];
    assert.deepEqual(result, expected);
  });

  it('should parse tags with interpolated content', () => {
    const result = db.parse('<foo>a{1}</foo>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(
          new astXQuery.ASTName('foo'),
          [],
          ['a', [wrapPath(new astXQuery.ASTNumberLiteral('1'))]]
        )
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse tags with interpolated attributes', () => {
    const result = db.parse('<foo bar="{1}"></foo>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(new astXQuery.ASTName('foo'), [
          [
            new astXQuery.ASTName('bar'),
            new astXQuery.DirConstrContent([
              [wrapPath(new astXQuery.ASTNumberLiteral('1'))],
            ]),
          ],
        ])
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse nested interpolated content', () => {
    const result = db.parse('<foo>{<a>{2}</a>}</foo>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(
          new astXQuery.ASTName('foo'),
          [],
          [
            [
              wrapPath(
                new astXQuery.DirectElementConstructor(
                  new astXQuery.ASTName('a'),
                  [],
                  [[wrapPath(new astXQuery.ASTNumberLiteral('2'))]]
                )
              ),
            ],
          ]
        )
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should parse empty attributes', () => {
    const result = db.parse('<foo bar=""></foo>').value.body;
    const expected = [
      wrapPath(
        new astXQuery.DirectElementConstructor(new astXQuery.ASTName('foo'), [
          [new astXQuery.ASTName('bar'), new astXQuery.DirConstrContent([])],
        ])
      ),
    ];
    assert.deepEqual(result, expected);
  });

  it('should not allow mismatched tags', () => {
    assert.throws(() => db.parse('<foo></bar>'));
  });

  it('should not allow unclosed tags', () => {
    assert.throws(() => db.parse('<foo>'));
  });
});
