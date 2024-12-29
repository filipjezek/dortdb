import { ASTIdentifier } from '../ast.js';
import { LanguageManager } from '../lang-manager.js';
import * as operators from '../plan/operators/index.js';
import {
  LogicalOpOrId,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../plan/visitor.js';

export type CalculationParams = {
  args: LogicalOpOrId[];
  impl: (...args: any[]) => any;
  literal?: boolean;
};

// avoid creating a new function every time
function ret1<T>(a: T): T {
  return a;
}
function isLit(a: CalculationParams | ASTIdentifier) {
  return (a as CalculationParams).literal;
}
function callImpl(a: CalculationParams) {
  return a.impl();
}
function getArgs(a: CalculationParams | ASTIdentifier) {
  return a instanceof ASTIdentifier ? a : a.args;
}
function getWhenThenArgs(
  a: [CalculationParams | ASTIdentifier, CalculationParams | ASTIdentifier]
) {
  return [getArgs(a[0]), getArgs(a[1])];
}

export class CalculationBuilder
  implements LogicalPlanVisitor<CalculationParams>
{
  constructor(
    private vmap: Record<string, LogicalPlanVisitor<CalculationParams>>,
    private langMgr: LanguageManager
  ) {
    this.processItem = this.processItem.bind(this);
    this.processWhenThen = this.processWhenThen.bind(this);
  }

  visitProjection(operator: operators.Projection): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitSelection(operator: operators.Selection): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitTupleSource(operator: operators.TupleSource): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitItemSource(operator: operators.ItemSource): CalculationParams {
    return { args: [operator], impl: ret1 };
  }

  private processItem(item: LogicalOpOrId) {
    return item instanceof ASTIdentifier ? item : item.accept(this.vmap);
  }
  visitFnCall(operator: operators.FnCall): CalculationParams {
    const children = operator.args.map(this.processItem);
    if (operator.pure && children.every(isLit)) {
      const args = (children as CalculationParams[]).map(callImpl);
      return { args: [], impl: () => operator.impl(...args), literal: true };
    }

    return {
      args: children.flatMap(getArgs),
      impl: (...args: any[]) => {
        let i = 0;
        const resolvedArgs = children.map((ch) => {
          if (ch instanceof ASTIdentifier) {
            return args[i++];
          }
          return ch.impl(...args.slice(i, (i += ch.args.length)));
        });
        return operator.impl(...resolvedArgs);
      },
    };
  }
  visitLiteral(operator: operators.Literal): CalculationParams {
    return { args: [], impl: () => operator.value, literal: true };
  }
  visitCalculation(operator: operators.Calculation): CalculationParams {
    return { args: [operator], impl: ret1 };
  }

  private processWhenThen(item: [LogicalOpOrId, LogicalOpOrId]) {
    return [this.processItem(item[0]), this.processItem(item[1])] as [
      CalculationParams | ASTIdentifier,
      CalculationParams | ASTIdentifier
    ];
  }
  visitConditional(operator: operators.Conditional): CalculationParams {
    const whenthens = operator.whenThens.map(this.processWhenThen);
    const cond = operator.condition && this.processItem(operator.condition);
    const defaultCase =
      operator.defaultCase && this.processItem(operator.defaultCase);
    const args: (
      | (ASTIdentifier | LogicalOpOrId[])[]
      | (ASTIdentifier | LogicalOpOrId[])
    )[] = whenthens.map(getWhenThenArgs);
    if (cond) args.unshift(getArgs(cond));
    if (defaultCase) args.push(getArgs(defaultCase));

    if ((cond as CalculationParams).literal) {
      const resolvedCond = (cond as CalculationParams).impl();
      let broken = false;
      // try to compute during compilation
      for (const [w, t] of whenthens) {
        if ((w as CalculationParams).literal) {
          if (resolvedCond === (w as CalculationParams).impl()) {
            if ((t as CalculationParams).literal) {
              return {
                args: [],
                impl: () => (t as CalculationParams).impl(),
                literal: true,
              };
            }
            broken = true;
            break;
          }
        } else {
          broken = true;
          break;
        }
      }
      if (
        !broken &&
        defaultCase &&
        (defaultCase as CalculationParams).literal
      ) {
        return {
          args: [],
          impl: () => (defaultCase as CalculationParams).impl(),
          literal: true,
        };
      }
    }
    return {
      args: args.flat(2),
      impl: (...args: any[]) => {
        let i = 0;
        const resolve = (a: CalculationParams | ASTIdentifier) =>
          a instanceof ASTIdentifier
            ? args[i++]
            : a.impl(...args.slice(i, (i += a.args.length)));
        const resolvedCond = cond ? resolve(cond) : true;
        const caseI = whenthens.findIndex(([w, t]) => {
          const res = resolve(w) === resolvedCond;
          i += t instanceof ASTIdentifier ? 1 : t.args.length;
          return res;
        });

        if (caseI === -1) {
          return defaultCase ? resolve(defaultCase) : null;
        }
        const t = whenthens[caseI][1];
        i -= t instanceof ASTIdentifier ? 1 : t.args.length;
        return resolve(t);
      },
    };
  }
  visitCartesianProduct(
    operator: operators.CartesianProduct
  ): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitJoin(operator: operators.Join): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitLeftOuterJoin(operator: operators.LeftOuterJoin): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitFullOuterJoin(operator: operators.FullOuterJoin): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitProjectionConcat(
    operator: operators.ProjectionConcat
  ): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitMapToItem(operator: operators.MapToItem): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitMapFromItem(operator: operators.MapFromItem): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitProjectionIndex(operator: operators.ProjectionIndex): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitOrderBy(operator: operators.OrderBy): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitGroupBy(operator: operators.GroupBy): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
}
