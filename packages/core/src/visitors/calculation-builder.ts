import { assertMaxOne, ret1, ret2 } from '../internal-fns/index.js';
import { ASTIdentifier } from '../ast.js';
import * as plan from '../plan/operators/index.js';
import {
  OpOrId,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../plan/visitor.js';
import { resolveArgs } from '../utils/invoke.js';
import { DortDBAsFriend } from '../db.js';
import { or } from '../operators/logical.js';

export interface ArgMeta {
  /** Evaluation of this argument may be skipped, for example,
   * if it is a part of OR or AND expressions.
   */
  maybeSkipped?: boolean;
  /**
   * This argument is the result of this aggregation.
   */
  aggregate?: plan.AggregateCall;
  /**
   * Where exactly is this argument located? Used for argument replacements
   * during query planning.
   */
  originalLocations: {
    /** The original object containing this argument. */
    obj: any;
    /** The key in the original object. */
    key: string | number;
    /** The containing operator. */
    op: PlanOperator;
    /**
     * This argument is an identifier and its location is in an {@link plan.FnCall}.
     * This is important, because if the argument is to be later replaced with a {@link PlanOperator},
     * the replacement must be in the form of {@link plan.PlanOpAsArg}.
     */
    idAsFnArg?: boolean;
  }[];
  /**
   * This argument is used multiple times in the calculation.
   */
  usedMultipleTimes?: boolean;
  /**
   * This argument may be a sequence of values. No enforcement of single value is necessary.
   */
  acceptSequence?: boolean;
}

/**
 * Represents the parameters for a calculation.
 */
export interface CalculationParams {
  /**
   * The arguments for the calculation.
   */
  args: OpOrId[];
  /**
   * The implementation of the calculation.
   */
  impl: (...args: any[]) => unknown;
  /**
   * Metadata for the arguments.
   */
  argMeta: ArgMeta[];
  /**
   * Whether the calculation is a literal value.
   */
  literal?: boolean;
  /**
   * The aggregate function results used in the calculation.
   */
  aggregates?: plan.AggregateCall[];
}

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
function getMetas(
  a: CalculationParams | ASTIdentifier,
  obj: any,
  key: string | number,
  op: PlanOperator,
  fnArg?: boolean,
): ArgMeta[] {
  if (a instanceof ASTIdentifier) {
    return [{ originalLocations: [{ obj, key, op, idAsFnArg: fnArg }] }];
  }
  for (const m of a.argMeta) {
    if (m.originalLocations.length === 0) {
      m.originalLocations.push(
        'op' in obj[key] ? { obj: obj[key], key: 'op', op } : { obj, key, op },
      );
    }
  }
  return a.argMeta;
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
function getWhenThenMetas(
  a: [CalculationParams | ASTIdentifier, CalculationParams | ASTIdentifier],
  obj: any,
  op: plan.Conditional,
) {
  return [getMetas(a[0], obj, 0, op), getMetas(a[1], obj, 1, op)];
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
  return op instanceof plan.Quantifier;
}
function getQuantifierIndices(
  args: (ASTIdentifier | plan.PlanOpAsArg)[],
  type: plan.QuantifierType,
) {
  return args
    .map(ret2)
    .filter(
      (i) =>
        !(args[i] instanceof ASTIdentifier) &&
        args[i].op instanceof plan.Quantifier &&
        args[i].op.type === type,
    );
}

/**
 * Builds a {@link plan.Calculation} from the given operator.
 */
export class CalculationBuilder implements PlanVisitor<CalculationParams> {
  constructor(
    protected vmap: Record<string, PlanVisitor<CalculationParams>>,
    protected db: DortDBAsFriend,
  ) {
    this.processItem = this.processItem.bind(this);
    this.processFnArg = this.processFnArg.bind(this);
    this.processWhenThen = this.processWhenThen.bind(this);
  }

  protected toItem(op: PlanTupleOperator): plan.MapToItem {
    const oldParent = op.parent;
    const toItem = new plan.MapToItem(op.lang, null, op);
    if (oldParent) {
      oldParent.replaceChild(op, toItem);
    }
    return toItem;
  }

  visitProjection(operator: plan.Projection): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitSelection(operator: plan.Selection): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitTupleSource(operator: plan.TupleSource): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitItemSource(operator: plan.ItemSource): CalculationParams {
    return {
      args: [operator],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }

  protected processItem(item: OpOrId): CalculationParams | ASTIdentifier {
    if (item instanceof ASTIdentifier) return item;
    if (item instanceof plan.FnCall && item.impl === ret1)
      return this.processItem(
        item.args[0] instanceof ASTIdentifier ? item.args[0] : item.args[0].op,
      );
    return item.accept(this.vmap);
  }
  protected processQuantifiedFn(
    operator: plan.FnCall,
    children: (CalculationParams | ASTIdentifier)[],
  ) {
    return (...args: unknown[]) => {
      const resolvedArgs = resolveArgs(args, children);
      const anyIs = getQuantifierIndices(
        operator.args,
        plan.QuantifierType.ANY,
      );
      const allIs = getQuantifierIndices(
        operator.args,
        plan.QuantifierType.ALL,
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
  protected processFnArg(
    arg: plan.PlanOpAsArg | ASTIdentifier,
  ): CalculationParams | ASTIdentifier {
    if (arg instanceof ASTIdentifier) return arg;
    const params = arg.op.accept(this.vmap);
    if (arg.acceptSequence && params.impl === assertMaxOne) {
      params.impl = ret1;
    }
    return params;
  }
  visitFnCall(operator: plan.FnCall): CalculationParams {
    operator.args.forEach((arg, i) => {
      const fn = (arg as plan.PlanOpAsArg).op as plan.FnCall;
      if (!(fn instanceof plan.FnCall)) return;
      if (fn.impl === ret1) operator.args[i] = fn.args[0];
    });
    const children = operator.args.map(this.processFnArg);
    if (operator.pure && children.every(isLit)) {
      const args = (children as CalculationParams[]).map(callImpl);
      const precomputed = operator.impl(...args);
      return {
        args: [],
        impl: () => precomputed,
        literal: true,
        argMeta: [],
      };
    }
    const nestedMetas = children.map((ch, i) =>
      getMetas(ch, operator.args, i, operator, true),
    );
    for (let i = 0; i < nestedMetas.length; i++) {
      if (
        !(operator.args[i] instanceof ASTIdentifier) &&
        !(plan.CalcIntermediate in (operator.args[i] as plan.PlanOpAsArg).op)
      ) {
        nestedMetas[i][0].acceptSequence =
          (operator.args[i] as plan.PlanOpAsArg).acceptSequence ?? false;
      }
    }
    const metas = nestedMetas.flat();
    if (operator.impl === or.impl) {
      for (let i = nestedMetas[0].length; i < metas.length; i++) {
        metas[i].maybeSkipped = true;
      }
    }

    return {
      args: children.flatMap(getArgs),
      impl: operator.args.some(isQuantifier)
        ? this.processQuantifiedFn(operator, children)
        : (...args: unknown[]) => {
            const resolvedArgs = resolveArgs(args, children);
            return operator.impl(...resolvedArgs);
          },
      argMeta: metas,
      aggregates: children.flatMap(getAggrs),
    };
  }
  visitLiteral(operator: plan.Literal<unknown>): CalculationParams {
    return {
      args: [],
      impl: () => operator.value,
      literal: true,
      argMeta: [],
    };
  }
  visitCalculation(operator: plan.Calculation): CalculationParams {
    return {
      args: [operator],
      impl: ret1,
      argMeta: [{ originalLocations: [] }],
    };
  }

  protected processWhenThen(item: [OpOrId, OpOrId]) {
    return [this.processItem(item[0]), this.processItem(item[1])] as [
      CalculationParams | ASTIdentifier,
      CalculationParams | ASTIdentifier,
    ];
  }
  visitConditional(operator: plan.Conditional): CalculationParams {
    const whenthens = operator.whenThens.map(this.processWhenThen);
    const cond = operator.condition && this.processItem(operator.condition);
    const defaultCase =
      operator.defaultCase && this.processItem(operator.defaultCase);
    const args: ((ASTIdentifier | OpOrId[]) | (ASTIdentifier | OpOrId[])[])[] =
      whenthens.map(getWhenThenArgs);
    const aggrs: (
      | plan.AggregateCall
      | plan.AggregateCall[]
      | plan.AggregateCall[][]
    )[] = whenthens.map(getWhenThenAggrs);
    const metas = whenthens
      .map((wt, i) => getWhenThenMetas(wt, operator.whenThens[i], operator))
      .flat(2);
    if (defaultCase) {
      args.push(getArgs(defaultCase));
      aggrs.push(getAggrs(defaultCase));
      metas.push(...getMetas(defaultCase, operator, 'defaultCase', operator));
    }
    for (const m of metas) {
      if (m) {
        m.maybeSkipped = true;
      }
    }
    if (cond) {
      args.unshift(getArgs(cond));
      aggrs.push(getAggrs(cond));
      metas.unshift(...getMetas(cond, operator, 'condition', operator));
    }

    if ((cond as CalculationParams)?.literal) {
      const maybeProcessed = this.processLiteralConditional(
        cond as CalculationParams,
        whenthens,
        defaultCase,
      );
      if (maybeProcessed) {
        return maybeProcessed;
      }
    }

    return {
      args: args.flat(2),
      argMeta: metas,
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

  protected processLiteralConditional(
    cond: CalculationParams,
    whenthens: [
      CalculationParams | ASTIdentifier,
      CalculationParams | ASTIdentifier,
    ][],
    defaultCase?: ASTIdentifier | CalculationParams,
  ): CalculationParams | null {
    const resolvedCond = cond.impl();
    let broken = false;
    // try to compute during compilation
    for (const [w, t] of whenthens) {
      if ((w as CalculationParams).literal) {
        if (resolvedCond === (w as CalculationParams).impl()) {
          if ((t as CalculationParams).literal) {
            const precomputed = (t as CalculationParams).impl();
            return {
              args: [],
              impl: () => precomputed,
              literal: true,
              argMeta: [],
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
    if (!broken && defaultCase && (defaultCase as CalculationParams).literal) {
      const precomputed = (defaultCase as CalculationParams).impl();
      return {
        args: [],
        impl: () => precomputed,
        literal: true,
        argMeta: [],
      };
    }
    return null;
  }

  visitCartesianProduct(operator: plan.CartesianProduct): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitJoin(operator: plan.Join): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitProjectionConcat(operator: plan.ProjectionConcat): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitMapToItem(operator: plan.MapToItem): CalculationParams {
    return {
      args: [operator],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitMapFromItem(operator: plan.MapFromItem): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitProjectionIndex(operator: plan.ProjectionIndex): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitOrderBy(operator: plan.OrderBy): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitGroupBy(operator: plan.GroupBy): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitLimit(operator: plan.Limit): CalculationParams {
    return {
      args: [
        operator.source instanceof PlanTupleOperator
          ? this.toItem(operator)
          : operator,
      ],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitUnion(operator: plan.Union): CalculationParams {
    return {
      args: [
        operator.left instanceof PlanTupleOperator
          ? this.toItem(operator)
          : operator,
      ],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitIntersection(operator: plan.Intersection): CalculationParams {
    return {
      args: [
        operator.left instanceof PlanTupleOperator
          ? this.toItem(operator)
          : operator,
      ],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitDifference(operator: plan.Difference): CalculationParams {
    return {
      args: [
        operator.left instanceof PlanTupleOperator
          ? this.toItem(operator)
          : operator,
      ],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitDistinct(operator: plan.Distinct): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitNullSource(operator: plan.NullSource): CalculationParams {
    return {
      args: [operator],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitAggregate(operator: plan.AggregateCall): CalculationParams {
    return {
      args: [operator.fieldName],
      impl: ret1,
      aggregates: [operator],
      argMeta: [{ aggregate: operator, originalLocations: [] }],
    };
  }
  visitItemFnSource(operator: plan.ItemFnSource): CalculationParams {
    return {
      args: [operator],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitTupleFnSource(operator: plan.TupleFnSource): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitQuantifier(operator: plan.Quantifier): CalculationParams {
    return operator.query.accept(this.vmap);
  }
  visitRecursion(operator: plan.Recursion): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitIndexScan(operator: plan.IndexScan): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitIndexedRecursion(operator: plan.IndexedRecursion): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitBidirectionalRecursion(
    operator: plan.BidirectionalRecursion,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
}
