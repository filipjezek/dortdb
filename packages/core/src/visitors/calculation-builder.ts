import { ASTIdentifier } from '../ast.js';
import { LanguageManager } from '../lang-manager.js';
import * as operators from '../plan/operators/index.js';
import { LogicalOpOrId, LogicalPlanVisitor } from '../plan/visitor.js';
import { resolveArgs } from '../utils/invoke.js';

export type CalculationParams = {
  args: LogicalOpOrId[];
  impl: (...args: any[]) => any;
  literal?: boolean;
  aggregates?: operators.AggregateCall[];
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
function getAggrs(a: CalculationParams | ASTIdentifier) {
  return (a instanceof ASTIdentifier ? null : a.aggregates) ?? [];
}
function getWhenThenArgs(
  a: [CalculationParams | ASTIdentifier, CalculationParams | ASTIdentifier]
) {
  return [getArgs(a[0]), getArgs(a[1])];
}
function getWhenThenAggrs(
  a: [CalculationParams | ASTIdentifier, CalculationParams | ASTIdentifier]
) {
  return [getAggrs(a[0]), getAggrs(a[1])];
}
function* cartesian(iters: Iterable<any>[]): Iterable<any[]> {
  if (iters.length === 0) {
    return [];
  }

  for (const val of iters[0]) {
    if (iters.length === 1) {
      yield [val];
    } else {
      for (const rest of cartesian(iters.slice(1))) {
        yield [val, ...rest];
      }
    }
  }
}
function isQuantifier(op: any) {
  return op instanceof operators.Quantifier;
}
function toArray<T>(a: Iterable<T>) {
  return Array.isArray(a) ? a : Array.from(a);
}
function ret2<T>(a: any, i: T) {
  return i;
}
function getQuantifierIndices(
  args: LogicalOpOrId[],
  type: operators.QuantifierType
) {
  return args
    .map(ret2)
    .filter(
      (i) => args[i] instanceof operators.Quantifier && args[i].type === type
    );
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
      impl: operator.args.some(isQuantifier)
        ? (...args: any[]) => {
            const resolvedArgs = resolveArgs(args, children);
            const anyIs = getQuantifierIndices(
              operator.args,
              operators.QuantifierType.ANY
            );
            const allIs = getQuantifierIndices(
              operator.args,
              operators.QuantifierType.ALL
            );
            let anys = anyIs.map((i) => resolvedArgs[i]);
            let alls = allIs.map((i) => resolvedArgs[i]);

            if (anys.length + alls.length > 1) {
              anys = anys.map(toArray);
              alls = alls.map(toArray);
            }
            anyLoop: for (const anyVals of anys.length
              ? cartesian(anys)
              : [[]]) {
              for (const allVals of alls.length ? cartesian(alls) : [[]]) {
                for (let i = 0; i < anyIs.length; i++) {
                  resolvedArgs[anyIs[i]] = anyVals[i];
                }
                for (let i = 0; i < allIs.length; i++) {
                  resolvedArgs[allIs[i]] = allVals[i];
                }
                if (!operator.impl(...resolvedArgs)) {
                  continue anyLoop;
                }
              }
              return true;
            }
            return false;
          }
        : (...args: any[]) => {
            const resolvedArgs = resolveArgs(args, children);
            return operator.impl(...resolvedArgs);
          },
      aggregates: children.flatMap(getAggrs),
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
    const aggrs: (
      | operators.AggregateCall
      | operators.AggregateCall[]
      | operators.AggregateCall[][]
    )[] = whenthens.map(getWhenThenAggrs);
    if (cond) {
      args.unshift(getArgs(cond));
      aggrs.push(getAggrs(cond));
    }
    if (defaultCase) {
      args.push(getArgs(defaultCase));
      aggrs.push(getAggrs(defaultCase));
    }

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
      aggregates: aggrs.flat(2),
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
  visitLimit(operator: operators.Limit): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitUnion(operator: operators.Union): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitUnionAll(operator: operators.UnionAll): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitIntersection(operator: operators.Intersection): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitDifference(operator: operators.Difference): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitDistinct(operator: operators.Distinct): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitNullSource(operator: operators.NullSource): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitAggregate(operator: operators.AggregateCall): CalculationParams {
    return { args: [operator.fieldName], impl: ret1, aggregates: [operator] };
  }
  visitItemFnSource(operator: operators.ItemFnSource): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitTupleFnSource(operator: operators.TupleFnSource): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
  visitQuantifier(operator: operators.Quantifier): CalculationParams {
    return { args: [operator], impl: ret1 };
  }
}
