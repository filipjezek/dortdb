import { ASTOperator, DortDB, LangSwitch } from '@dortdb/core';
import { Cypher } from '../../src/language/language.js';
import * as astCypher from '../../src/ast/index.js';

describe('AST langswitch', () => {
  const db = new DortDB({
    mainLang: Cypher(),
    optimizer: { rules: [] },
  });

  it('should parse langswitch with mutiple scope exits', () => {
    const expected = new astCypher.Query([
      new astCypher.ReturnClause(
        new astCypher.ProjectionBody([
          new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
            new ASTOperator('cypher', new astCypher.CypherIdentifier('+'), [
              new astCypher.CypherIdentifier('z'),
              new LangSwitch('cypher', [
                new astCypher.Query([
                  new astCypher.ReturnClause(
                    new astCypher.ProjectionBody([
                      new ASTOperator(
                        'cypher',
                        new astCypher.CypherIdentifier('+'),
                        [
                          new astCypher.CypherIdentifier('c'),
                          new astCypher.CypherIdentifier('d'),
                        ],
                      ),
                    ]),
                  ),
                ]),
              ]),
            ]),
            new astCypher.CypherIdentifier('y'),
          ]),
        ]),
      ),
    ]);
    expected.from = (
      expected.statements[0] as any
    ).body.items[0].operands[0].operands[1].node.from =
      new astCypher.CypherIdentifier('g');
    for (const query of [
      'from g return z + (lang cypher from g return c + d) + y',
      'from g return z + (lang cypher from g return (c + d)) + y',
      'from g return (z + (lang cypher from g return c + d)) + y',
      'from g return (z + (lang cypher from g return (c + d))) + y',
    ]) {
      const result = db.parse(query)[0];
      expect(result).toEqual(expected);
    }
  });
});
