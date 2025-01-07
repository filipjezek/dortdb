import { describe, it, before } from 'node:test';
import { ASTFunction, DortDB } from '@dortdb/core';
import { SQL } from '../../src/index.js';
import assert from 'node:assert/strict';
import * as astSQL from '../../src/ast/index.js';
import { ASTOperator } from '@dortdb/core';

describe('AST Expressions', () => {
  const db = new DortDB({
    mainLang: SQL,
  });

  describe('operators', () => {
    it('should preserve operator precedence', () => {
      const result = db.parse('SELECT 1 + 2 * 3 - 5 ^ 8 ~ a.b[3]::int').value;
      const expected = [
        new astSQL.SelectStatement(
          new astSQL.SelectSet([
            new ASTOperator('sql', new astSQL.SQLIdentifier('~'), [
              new ASTOperator('sql', new astSQL.SQLIdentifier('-'), [
                new ASTOperator('sql', new astSQL.SQLIdentifier('+'), [
                  new astSQL.ASTNumberLiteral('1'),
                  new ASTOperator('sql', new astSQL.SQLIdentifier('*'), [
                    new astSQL.ASTNumberLiteral('2'),
                    new astSQL.ASTNumberLiteral('3'),
                  ]),
                ]),
                new ASTOperator('sql', new astSQL.SQLIdentifier('^'), [
                  new astSQL.ASTNumberLiteral('5'),
                  new astSQL.ASTNumberLiteral('8'),
                ]),
              ]),
              new astSQL.ASTCast(
                new astSQL.ASTSubscript(
                  new astSQL.SQLIdentifier('b', 'a'),
                  new astSQL.ASTNumberLiteral('3')
                ),
                new astSQL.SQLIdentifier('int')
              ),
            ]),
          ])
        ),
      ];
      assert.deepEqual(result, expected);
    });
    it('should preserve associativity', () => {
      const result = db.parse('SELECT 1 - 2 - 3').value;
      const expected = [
        new astSQL.SelectStatement(
          new astSQL.SelectSet([
            new ASTOperator('sql', new astSQL.SQLIdentifier('-'), [
              new ASTOperator('sql', new astSQL.SQLIdentifier('-'), [
                new astSQL.ASTNumberLiteral('1'),
                new astSQL.ASTNumberLiteral('2'),
              ]),
              new astSQL.ASTNumberLiteral('3'),
            ]),
          ])
        ),
      ];
      assert.deepEqual(result, expected);
    });
  });

  describe('function calls', () => {
    it('should parse function calls', () => {
      const result = db.parse('SELECT foo(1, 2, 3)').value;
      const expected = [
        new astSQL.SelectStatement(
          new astSQL.SelectSet([
            new ASTFunction('sql', new astSQL.SQLIdentifier('foo'), [
              new astSQL.ASTNumberLiteral('1'),
              new astSQL.ASTNumberLiteral('2'),
              new astSQL.ASTNumberLiteral('3'),
            ]),
          ])
        ),
      ];
      assert.deepEqual(result, expected);
    });
    it('should parse function calls with one subquery', () => {
      const result = db.parse('SELECT foo(SELECT 1)').value;
      const expected = [
        new astSQL.SelectStatement(
          new astSQL.SelectSet([
            new ASTFunction('sql', new astSQL.SQLIdentifier('foo'), [
              new astSQL.SelectStatement(
                new astSQL.SelectSet([new astSQL.ASTNumberLiteral('1')])
              ),
            ]),
          ])
        ),
      ];
      assert.deepEqual(result, expected);
    });
    it('should parse function calls with multiple subquueries', () => {
      const result = db.parse('SELECT foo((SELECT 1), (SELECT 2))').value;
      const expected = [
        new astSQL.SelectStatement(
          new astSQL.SelectSet([
            new ASTFunction('sql', new astSQL.SQLIdentifier('foo'), [
              new astSQL.SelectStatement(
                new astSQL.SelectSet([new astSQL.ASTNumberLiteral('1')])
              ),
              new astSQL.SelectStatement(
                new astSQL.SelectSet([new astSQL.ASTNumberLiteral('2')])
              ),
            ]),
          ])
        ),
      ];
      assert.deepEqual(result, expected);
    });
  });

  describe('quantified queries', () => {
    it('should parse quantified queries', () => {
      for (const operator of ['>', '>=', '=']) {
        for (const quantifier of ['ALL', 'ANY']) {
          const result = db.parse(
            `SELECT 1 ${operator} ${quantifier} (SELECT 2)`
          ).value;
          const expected = [
            new astSQL.SelectStatement(
              new astSQL.SelectSet([
                new ASTOperator('sql', new astSQL.SQLIdentifier(operator), [
                  new astSQL.ASTNumberLiteral('1'),
                  new astSQL.ASTQuantifier(
                    quantifier,
                    new astSQL.SelectStatement(
                      new astSQL.SelectSet([new astSQL.ASTNumberLiteral('2')])
                    )
                  ),
                ]),
              ])
            ),
          ];
          assert.deepEqual(result, expected);
        }
      }
    });
  });

  describe('case expressions', () => {
    it('should parse if-else style expressions', () => {
      const result = db.parse(
        'SELECT CASE WHEN 1 THEN 2 WHEN 3 THEN 4 ELSE 5 END'
      ).value;
      const expected = [
        new astSQL.SelectStatement(
          new astSQL.SelectSet([
            new astSQL.ASTCase(
              undefined,
              [
                [
                  new astSQL.ASTNumberLiteral('1'),
                  new astSQL.ASTNumberLiteral('2'),
                ],
                [
                  new astSQL.ASTNumberLiteral('3'),
                  new astSQL.ASTNumberLiteral('4'),
                ],
              ],
              new astSQL.ASTNumberLiteral('5')
            ),
          ])
        ),
      ];
      assert.deepEqual(result, expected);
    });
    it('should parse switch style expressions', () => {
      const result = db.parse(
        'SELECT CASE a WHEN 2 THEN 3 WHEN 4 THEN 5 ELSE 6 END'
      ).value;
      const expected = [
        new astSQL.SelectStatement(
          new astSQL.SelectSet([
            new astSQL.ASTCase(
              new astSQL.SQLIdentifier('a'),
              [
                [
                  new astSQL.ASTNumberLiteral('2'),
                  new astSQL.ASTNumberLiteral('3'),
                ],
                [
                  new astSQL.ASTNumberLiteral('4'),
                  new astSQL.ASTNumberLiteral('5'),
                ],
              ],
              new astSQL.ASTNumberLiteral('6')
            ),
          ])
        ),
      ];
      assert.deepEqual(result, expected);
    });
  });

  it('should parse numbers', () => {
    for (const [original, expected] of [
      ['1', 1],
      ['1.2', 1.2],
      ['1.2e2', 1.2e2],
      ['0b1001', 9],
      ['0x10', 16],
      ['0o10', 8],
    ]) {
      const result = db.parse(`SELECT ${original}`).value;
      assert.deepEqual(
        (result[0].selectSet.items[0] as astSQL.ASTNumberLiteral).value,
        expected
      );
    }
  });

  it('should parse strings', () => {
    for (const [original, expected] of [
      ["'hello'", 'hello'],
      ["'hel''lo'", "hel'lo"],
      ["'he\\l\\n\\t\\x99\\u1234\\127lo'", 'he\\l\n\t\x99\u1234Wlo'],
      ['$$hel\'"lo$$', 'hel\'"lo'],
      ['$foo$hel$$lo$foo$', 'hel$$lo'],
    ]) {
      const result = db.parse(`SELECT ${original}`).value;
      assert.deepEqual(
        (result[0].selectSet.items[0] as astSQL.ASTStringLiteral).value,
        expected
      );
    }
  });

  describe('comments', () => {
    it('should ignore line comments', () => {
      const result = db.parse(`
        SELECT 1, -- 2,
        -- 3,
        4`).value;
      const expected = [
        new astSQL.SelectStatement(
          new astSQL.SelectSet([
            new astSQL.ASTNumberLiteral('1'),
            new astSQL.ASTNumberLiteral('4'),
          ])
        ),
      ];
      assert.deepEqual(result, expected);
    });

    it('should ignore block comments', () => {
      const result = db.parse(`
        SELECT 1, /* 2,
        /* 3, */ 4, */ 5`).value;
      const expected = [
        new astSQL.SelectStatement(
          new astSQL.SelectSet([
            new astSQL.ASTNumberLiteral('1'),
            new astSQL.ASTNumberLiteral('5'),
          ])
        ),
      ];
      assert.deepEqual(result, expected);
    });
  });
});
