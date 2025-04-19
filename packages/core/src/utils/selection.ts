import { ASTIdentifier } from '../ast.js';
import { and } from '../operators/logical.js';
import {
  CalcIntermediate,
  Calculation,
  FnCall,
  Selection,
} from '../plan/operators/index.js';
import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../plan/visitor.js';
import {
  CalculationParams,
  simplifyCalcParams,
} from '../visitors/calculation-builder.js';

/**
 * Converts a calculation intermediate expression into possibly multiple chained selections.
 */
export function exprToSelection(
  expr: LogicalPlanOperator | ASTIdentifier,
  source: LogicalPlanTupleOperator,
  calcBuilders: Record<string, LogicalPlanVisitor<CalculationParams>>,
  lang: Lowercase<string>,
) {
  const andsContainer: (LogicalPlanOperator | ASTIdentifier)[] = [];
  splitAnds(expr, andsContainer);
  for (const andExpr of andsContainer) {
    if (andExpr instanceof ASTIdentifier) {
      source = new Selection(lang, andExpr, source);
    } else {
      let calcParams = andExpr.accept(calcBuilders);
      calcParams = simplifyCalcParams(calcParams);
      const calc = new Calculation(
        lang,
        calcParams.impl,
        calcParams.args,
        calcParams.argMeta,
        calcParams.aggregates,
        calcParams.literal,
      );
      source = new Selection(lang, calc, source);
    }
  }
  return source;
}

function splitAnds(
  expr: LogicalPlanOperator | ASTIdentifier,
  andsContainer: (LogicalPlanOperator | ASTIdentifier)[],
) {
  if (!(expr instanceof FnCall) || expr.impl !== and.impl) {
    andsContainer.push(expr);
    return;
  }
  splitAnds(
    expr.args[0] instanceof ASTIdentifier ? expr.args[0] : expr.args[0].op,
    andsContainer,
  );
  splitAnds(
    expr.args[1] instanceof ASTIdentifier ? expr.args[1] : expr.args[1].op,
    andsContainer,
  );
}
