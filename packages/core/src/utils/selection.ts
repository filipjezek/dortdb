import { ASTIdentifier } from '../ast.js';
import { ret1 } from '../internal-fns/index.js';
import { and } from '../operators/logical.js';
import { Calculation, FnCall, Selection } from '../plan/operators/index.js';
import {
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../plan/visitor.js';
import {
  CalculationParams,
  simplifyCalcParams,
} from '../visitors/calculation-builder.js';
import { EqualityChecker } from '../visitors/equality-checker.js';

/**
 * Converts a calculation intermediate expression into possibly multiple chained selections.
 */
export function exprToSelection(
  expr: PlanOperator | ASTIdentifier,
  source: PlanTupleOperator,
  calcBuilders: Record<string, PlanVisitor<CalculationParams>>,
  eqCheckers: Record<string, EqualityChecker>,
  lang: Lowercase<string>,
) {
  const andsContainer: PlanOperator[] = [];
  if (expr instanceof ASTIdentifier) {
    andsContainer.push(new FnCall(lang, [expr], ret1));
  } else {
    splitAnds(expr, andsContainer);
  }
  for (const andExpr of andsContainer) {
    let calcParams = andExpr.accept(calcBuilders);
    calcParams = simplifyCalcParams(calcParams, eqCheckers, lang);
    const calc = new Calculation(
      lang,
      calcParams.impl,
      calcParams.args,
      calcParams.argMeta,
      andExpr,
      calcParams.aggregates,
      calcParams.literal,
    );
    source = new Selection(lang, calc, source);
  }
  return source;
}

function splitAnds(expr: PlanOperator, andsContainer: PlanOperator[]) {
  if (!(expr instanceof FnCall) || expr.impl !== and.impl) {
    andsContainer.push(expr);
    return;
  }
  splitAnds(
    expr.args[0] instanceof ASTIdentifier
      ? new FnCall(expr.lang, [expr.args[0]], ret1)
      : expr.args[0].op,
    andsContainer,
  );
  splitAnds(
    expr.args[1] instanceof ASTIdentifier
      ? new FnCall(expr.lang, [expr.args[1]], ret1)
      : expr.args[1].op,
    andsContainer,
  );
}
