import { describe, it, before } from 'node:test';
import { DortDB } from '@dortdb/core';
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
            new ASTOperator('sql', new astSQL.ASTIdentifier('~'), [
              new ASTOperator('sql', new astSQL.ASTIdentifier('-'), [
                new ASTOperator('sql', new astSQL.ASTIdentifier('+'), [
                  new astSQL.ASTNumberLiteral('1'),
                  new ASTOperator('sql', new astSQL.ASTIdentifier('*'), [
                    new astSQL.ASTNumberLiteral('2'),
                    new astSQL.ASTNumberLiteral('3'),
                  ]),
                ]),
                new ASTOperator('sql', new astSQL.ASTIdentifier('^'), [
                  new astSQL.ASTNumberLiteral('5'),
                  new astSQL.ASTNumberLiteral('8'),
                ]),
              ]),
              new astSQL.ASTCast(
                new astSQL.ASTSubscript(
                  new astSQL.ASTFieldSelector(
                    'b',
                    new astSQL.ASTIdentifier('a')
                  ),
                  new astSQL.ASTNumberLiteral('3')
                ),
                'int'
              ),
            ]),
          ])
        ),
      ];
      assert.deepEqual(result, expected);
    });
  });
});
