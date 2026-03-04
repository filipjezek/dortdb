import { ASTIdentifier } from '@dortdb/core';
import * as plan from '@dortdb/core/plan';

const op1 = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Op1']));
op1.addToSchema(ASTIdentifier.fromParts(['a']));
const op2 = new plan.TupleSource('sql', ASTIdentifier.fromParts(['Op2']));
op2.addToSchema(ASTIdentifier.fromParts(['b']));

const projConcatToJoinTree = new plan.ProjectionConcat('sql', op1, false, op2);

export { projConcatToJoinTree };
