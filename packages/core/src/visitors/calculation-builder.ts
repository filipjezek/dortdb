import { assertMaxOne, ret1, ret2 } from '../internal-fns/index.js';
import { ASTIdentifier } from '../ast.js';
import * as operators from '../plan/operators/index.js';
import {
  OpOrId,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../plan/visitor.js';
import { resolveArgs } from '../utils/invoke.js';
import { DortDBAsFriend } from '../db.js';
import { or } from '../operators/logical.js';
import { EqualityChecker } from './equality-checker.js';

export interface ArgMeta {
  maybeSkipped?: boolean;
  aggregate?: operators.AggregateCall;
  originalLocations: {
    obj: any;
    key: string | number;
    /** the location was for an identifier, operators should be passed as `PlanOpAsArg` */
    fnArg?: boolean;
  }[];
  usedMultipleTimes?: boolean;
  acceptSequence?: boolean;
}
export interface CalculationParams {
  args: OpOrId[];
  impl: (...args: any[]) => unknown;
  argMeta: ArgMeta[];
  literal?: boolean;
  aggregates?: operators.AggregateCall[];
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
  fnArg?: boolean,
): ArgMeta[] {
  if (a instanceof ASTIdentifier)
    return [{ originalLocations: [{ obj, key, fnArg }] }];
  for (const m of a.argMeta) {
    if (m.originalLocations.length === 0) {
      m.originalLocations.push(
        'op' in obj[key] ? { obj: obj[key], key: 'op' } : { obj, key },
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
) {
  return [getMetas(a[0], obj, 0), getMetas(a[1], obj, 1)];
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

export class CalculationBuilder implements PlanVisitor<CalculationParams> {
  constructor(
    protected vmap: Record<string, PlanVisitor<CalculationParams>>,
    protected db: DortDBAsFriend,
  ) {
    this.processItem = this.processItem.bind(this);
    this.processFnArg = this.processFnArg.bind(this);
    this.processWhenThen = this.processWhenThen.bind(this);
  }

  protected toItem(op: PlanTupleOperator): operators.MapToItem {
    const oldParent = op.parent;
    const toItem = new operators.MapToItem(op.lang, null, op);
    if (oldParent) {
      oldParent.replaceChild(op, toItem);
    }
    return toItem;
  }

  visitProjection(operator: operators.Projection): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitSelection(operator: operators.Selection): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitTupleSource(operator: operators.TupleSource): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitItemSource(operator: operators.ItemSource): CalculationParams {
    return {
      args: [operator],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }

  protected processItem(item: OpOrId) {
    return item instanceof ASTIdentifier ? item : item.accept(this.vmap);
  }
  protected processQuantifiedFn(
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
  protected processFnArg(arg: operators.PlanOpAsArg | ASTIdentifier) {
    if (arg instanceof ASTIdentifier) return arg;
    const params = arg.op.accept(this.vmap);
    if (arg.acceptSequence && params.impl === assertMaxOne) {
      params.impl = ret1;
    }
    return params;
  }
  visitFnCall(operator: operators.FnCall): CalculationParams {
    const children = operator.args.map(this.processFnArg);
    if (operator.pure && children.every(isLit)) {
      const args = (children as CalculationParams[]).map(callImpl);
      return {
        args: [],
        impl: () => operator.impl(...args),
        literal: true,
        argMeta: [],
      };
    }
    const nestedMetas = children.map((ch, i) =>
      getMetas(ch, operator.args, i, ch instanceof ASTIdentifier),
    );
    for (let i = 0; i < nestedMetas.length; i++) {
      if (
        !(operator.args[i] instanceof ASTIdentifier) &&
        !(
          operators.CalcIntermediate in
          (operator.args[i] as operators.PlanOpAsArg).op
        )
      ) {
        nestedMetas[i][0].acceptSequence =
          (operator.args[i] as operators.PlanOpAsArg).acceptSequence ?? false;
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
  visitLiteral(operator: operators.Literal<unknown>): CalculationParams {
    return {
      args: [],
      impl: () => operator.value,
      literal: true,
      argMeta: [],
    };
  }
  visitCalculation(operator: operators.Calculation): CalculationParams {
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
  visitConditional(operator: operators.Conditional): CalculationParams {
    const whenthens = operator.whenThens.map(this.processWhenThen);
    const cond = operator.condition && this.processItem(operator.condition);
    const defaultCase =
      operator.defaultCase && this.processItem(operator.defaultCase);
    const args: ((ASTIdentifier | OpOrId[]) | (ASTIdentifier | OpOrId[])[])[] =
      whenthens.map(getWhenThenArgs);
    const aggrs: (
      | operators.AggregateCall
      | operators.AggregateCall[]
      | operators.AggregateCall[][]
    )[] = whenthens.map(getWhenThenAggrs);
    const metas = whenthens
      .map((wt, i) => getWhenThenMetas(wt, operator.whenThens[i]))
      .flat(2);
    if (defaultCase) {
      args.push(getArgs(defaultCase));
      aggrs.push(getAggrs(defaultCase));
      metas.push(...getMetas(defaultCase, operator, 'defaultCase'));
    }
    for (const m of metas) {
      if (m) {
        m.maybeSkipped = true;
      }
    }
    if (cond) {
      args.unshift(getArgs(cond));
      aggrs.push(getAggrs(cond));
      metas.unshift(...getMetas(cond, operator, 'condition'));
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
            return {
              args: [],
              impl: () => (t as CalculationParams).impl(),
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
      return {
        args: [],
        impl: () => (defaultCase as CalculationParams).impl(),
        literal: true,
        argMeta: [],
      };
    }
    return null;
  }

  visitCartesianProduct(
    operator: operators.CartesianProduct,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitJoin(operator: operators.Join): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitProjectionConcat(
    operator: operators.ProjectionConcat,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitMapToItem(operator: operators.MapToItem): CalculationParams {
    return {
      args: [operator],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitMapFromItem(operator: operators.MapFromItem): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitProjectionIndex(operator: operators.ProjectionIndex): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitOrderBy(operator: operators.OrderBy): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitGroupBy(operator: operators.GroupBy): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitLimit(operator: operators.Limit): CalculationParams {
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
  visitUnion(operator: operators.Union): CalculationParams {
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
  visitIntersection(operator: operators.Intersection): CalculationParams {
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
  visitDifference(operator: operators.Difference): CalculationParams {
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
  visitDistinct(operator: operators.Distinct): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitNullSource(operator: operators.NullSource): CalculationParams {
    return {
      args: [operator],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitAggregate(operator: operators.AggregateCall): CalculationParams {
    return {
      args: [operator.fieldName],
      impl: ret1,
      aggregates: [operator],
      argMeta: [{ aggregate: operator, originalLocations: [] }],
    };
  }
  visitItemFnSource(operator: operators.ItemFnSource): CalculationParams {
    return {
      args: [operator],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitTupleFnSource(operator: operators.TupleFnSource): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitQuantifier(operator: operators.Quantifier): CalculationParams {
    return operator.query.accept(this.vmap);
  }
  visitRecursion(operator: operators.Recursion): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitIndexScan(operator: operators.IndexScan): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitIndexedRecursion(
    operator: operators.IndexedRecursion,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: assertMaxOne,
      argMeta: [{ originalLocations: [] }],
    };
  }
}
