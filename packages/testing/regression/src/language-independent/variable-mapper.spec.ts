import { ASTIdentifier, DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { PushdownSelections } from '@dortdb/core/optimizer';
import * as plan from '@dortdb/core/plan';

describe('VariableMapper', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: [PushdownSelections] },
  });
  db.registerSource(
    ['a'],
    [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ],
  );
  db.registerSource(
    ['b'],
    [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ],
  );

  it('should not reuse variables removed from scope', () => {
    const sourceA = new plan.TupleSource('sql', ASTIdentifier.fromParts(['a']));
    const sourceB = new plan.TupleSource('sql', ASTIdentifier.fromParts(['b']));
    sourceA.addToSchema([
      ASTIdentifier.fromParts(['x']),
      ASTIdentifier.fromParts(['y']),
    ]);
    sourceB.addToSchema([
      ASTIdentifier.fromParts(['x']),
      ASTIdentifier.fromParts(['y']),
    ]);
    let branchB = new plan.Projection(
      'sql',
      [[ASTIdentifier.fromParts(['x']), ASTIdentifier.fromParts(['x'])]],
      sourceB,
    );
    branchB = new plan.Projection(
      'sql',
      [
        [ASTIdentifier.fromParts(['x']), ASTIdentifier.fromParts(['xx'])],
        [ASTIdentifier.fromParts(['y']), ASTIdentifier.fromParts(['yy'])],
      ],
      branchB,
    );

    const queryPlan = new plan.ProjectionConcat('sql', branchB, false, sourceA);
    const result = db.executePlan(queryPlan);
    expect(Array.from(result.data)).toEqual([
      {
        x: 1,
        xx: 10,
        y: 2,
        yy: 2,
      },
      {
        x: 1,
        xx: 30,
        y: 2,
        yy: 2,
      },
      {
        x: 3,
        xx: 10,
        y: 4,
        yy: 4,
      },
      {
        x: 3,
        xx: 30,
        y: 4,
        yy: 4,
      },
    ]);
  });
});
