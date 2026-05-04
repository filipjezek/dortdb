import { IndexMatchInput } from '../indices/index.js';
import { or } from '../operators/logical.js';
import { FnCall } from '../plan/operators/index.js';
import { PlanOperator } from '../plan/visitor.js';
import { splitByOp } from './selection.js';

/** If the expressions come from an `or` expression, return an index match input group for each alternative */
export function getIMIAlternatives(expressions: IndexMatchInput[]): {
  nonOr: IndexMatchInput[];
  /** for each top-level `or` operator, for each of its alternatives */
  alternatives: Map<FnCall, IndexMatchInput[][]>;
} {
  const nonOr = expressions.filter(
    (expr) => expr.containingFn.impl !== or.impl,
  );
  const topOrs = new Set(
    expressions
      .filter((expr) => expr.containingFn.impl === or.impl)
      .map((expr) => expr.containingFn),
  );
  if (!topOrs.size) return { nonOr: expressions, alternatives: new Map() };

  const alternativeFns = Array.from(topOrs)
    .map((orFn) => [orFn, splitByOp(orFn, or)] as [FnCall, PlanOperator[]])
    .filter(([, orSubs]) => orSubs.every((sub) => sub instanceof FnCall)) as [
    FnCall,
    FnCall[],
  ][];
  const alternatives = alternativeFns.map(
    ([orFn, orSubs]) =>
      [
        orFn,
        orSubs.map((subexpr) =>
          subexpr.args.map((expr) => ({
            expr: 'op' in expr ? expr.op : expr,
            containingFn: subexpr as FnCall,
          })),
        ),
      ] as [FnCall, IndexMatchInput[][]],
  );

  return { nonOr, alternatives: new Map(alternatives) };
}
