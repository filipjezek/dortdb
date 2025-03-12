import { ret1, ret2 } from '../internal-fns/index.js';
import { ASTIdentifier } from '../ast.js';
import { LanguageManager } from '../lang-manager.js';
import * as operators from '../plan/operators/index.js';
import {
  LogicalOpOrId,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../plan/visitor.js';
import { resolveArgs } from '../utils/invoke.js';

export type CalculationParams = {
  args: LogicalOpOrId[];
  impl: (...args: any[]) => unknown;
  literal?: boolean;
  aggregates?: operators.AggregateCall[];
};

// avoid creating a new function every time

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
  a: [CalculationParams | ASTIdentifier, CalculationParams | ASTIdentifier],
) {
  return [getArgs(a[0]), getArgs(a[1])];
}
function getWhenThenAggrs(
  a: [CalculationParams | ASTIdentifier, CalculationParams | ASTIdentifier],
) {
  return [getAggrs(a[0]), getAggrs(a[1])];
}
function* cartesian(iters: Iterable<unknown>[]): Iterable<unknown[]> {
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
function isQuantifier(op: unknown) {
  return op instanceof operators.Quantifier;
}
function getQuantifierIndices(
  args: (ASTIdentifier | operators.PlanOpAsArg)[],
  type: operators.QuantifierType,
) {
  return args
    .map(ret2)
    .filter(
      (i) =>
        !(args[i] instanceof ASTIdentifier) &&
        args[i].op instanceof operators.Quantifier &&
        args[i].op.type === type,
    );
}

export class CalculationBuilder
  implements LogicalPlanVisitor<CalculationParams>
{
  constructor(
    private vmap: Record<string, LogicalPlanVisitor<CalculationParams>>,
    private langMgr: LanguageManager,
  ) {
    this.processItem = this.processItem.bind(this);
    this.processFnArg = this.processFnArg.bind(this);
    this.processWhenThen = this.processWhenThen.bind(this);
  }

  protected toItem(op: LogicalPlanTupleOperator): operators.MapToItem {
    return new operators.MapToItem(op.lang, null, op);
  }

  protected assertMaxOne<T>(vals: T[]): T {
    if (vals.length === 0) return null;
    if (vals.length > 1) throw new Error('More than one element in sequence');
    return vals[0];
  }

  visitProjection(operator: operators.Projection): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitSelection(operator: operators.Selection): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitTupleSource(operator: operators.TupleSource): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitItemSource(operator: operators.ItemSource): CalculationParams {
    return { args: [operator], impl: this.assertMaxOne };
  }

  private processItem(item: LogicalOpOrId) {
    return item instanceof ASTIdentifier ? item : item.accept(this.vmap);
  }
  private processQuantifiedFn(
    operator: operators.FnCall,
    children: (CalculationParams | ASTIdentifier)[],
  ) {
    return (...args: unknown[]) => {
      const resolvedArgs = resolveArgs(args, children);
      const anyIs = getQuantifierIndices(
        operator.args,
        operators.QuantifierType.ANY,
      );
      const allIs = getQuantifierIndices(
        operator.args,
        operators.QuantifierType.ALL,
      );
      const anys = anyIs.map((i) => resolvedArgs[i]) as unknown[][];
      const alls = allIs.map((i) => resolvedArgs[i]) as unknown[][];

      anyLoop: for (const anyVals of anys.length ? cartesian(anys) : [[]]) {
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
    };
  }
  private processFnArg(arg: operators.PlanOpAsArg | ASTIdentifier) {
    if (arg instanceof ASTIdentifier) return arg;
    const params = arg.op.accept(this.vmap);
    if (arg.acceptSequence && params.impl === this.assertMaxOne) {
      params.impl = ret1;
    }
    return params;
  }
  visitFnCall(operator: operators.FnCall): CalculationParams {
    const children = operator.args.map(this.processFnArg);
    if (operator.pure && children.every(isLit)) {
      const args = (children as CalculationParams[]).map(callImpl);
      return { args: [], impl: () => operator.impl(...args), literal: true };
    }

    return {
      args: children.flatMap(getArgs),
      impl: operator.args.some(isQuantifier)
        ? this.processQuantifiedFn(operator, children)
        : (...args: unknown[]) => {
            const resolvedArgs = resolveArgs(args, children);
            return operator.impl(...resolvedArgs);
          },
      aggregates: children.flatMap(getAggrs),
    };
  }
  visitLiteral(operator: operators.Literal<unknown>): CalculationParams {
    return { args: [], impl: () => operator.value, literal: true };
  }
  visitCalculation(operator: operators.Calculation): CalculationParams {
    return { args: [operator], impl: ret1 };
  }

  private processWhenThen(item: [LogicalOpOrId, LogicalOpOrId]) {
    return [this.processItem(item[0]), this.processItem(item[1])] as [
      CalculationParams | ASTIdentifier,
      CalculationParams | ASTIdentifier,
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

    if ((cond as CalculationParams)?.literal) {
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
      impl: (...args: unknown[]) => {
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
    operator: operators.CartesianProduct,
  ): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitJoin(operator: operators.Join): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitProjectionConcat(
    operator: operators.ProjectionConcat,
  ): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitMapToItem(operator: operators.MapToItem): CalculationParams {
    return { args: [operator], impl: this.assertMaxOne };
  }
  visitMapFromItem(operator: operators.MapFromItem): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitProjectionIndex(operator: operators.ProjectionIndex): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitOrderBy(operator: operators.OrderBy): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitGroupBy(operator: operators.GroupBy): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitLimit(operator: operators.Limit): CalculationParams {
    return {
      args: ['schema' in operator.source ? this.toItem(operator) : operator],
      impl: this.assertMaxOne,
    };
  }
  visitUnion(operator: operators.Union): CalculationParams {
    return {
      args: [
        operator.left instanceof LogicalPlanTupleOperator
          ? this.toItem(operator)
          : operator,
      ],
      impl: this.assertMaxOne,
    };
  }
  visitIntersection(operator: operators.Intersection): CalculationParams {
    return {
      args: [
        operator.left instanceof LogicalPlanTupleOperator
          ? this.toItem(operator)
          : operator,
      ],
      impl: this.assertMaxOne,
    };
  }
  visitDifference(operator: operators.Difference): CalculationParams {
    return {
      args: [
        operator.left instanceof LogicalPlanTupleOperator
          ? this.toItem(operator)
          : operator,
      ],
      impl: this.assertMaxOne,
    };
  }
  visitDistinct(operator: operators.Distinct): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitNullSource(operator: operators.NullSource): CalculationParams {
    return { args: [operator], impl: this.assertMaxOne };
  }
  visitAggregate(operator: operators.AggregateCall): CalculationParams {
    return { args: [operator.fieldName], impl: ret1, aggregates: [operator] };
  }
  visitItemFnSource(operator: operators.ItemFnSource): CalculationParams {
    return { args: [operator], impl: this.assertMaxOne };
  }
  visitTupleFnSource(operator: operators.TupleFnSource): CalculationParams {
    return { args: [this.toItem(operator)], impl: this.assertMaxOne };
  }
  visitQuantifier(operator: operators.Quantifier): CalculationParams {
    return operator.query.accept(this.vmap);
  }
}
