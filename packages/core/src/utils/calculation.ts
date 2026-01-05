import { ASTIdentifier } from '../ast.js';
import { ret1 } from '../internal-fns/index.js';
import { AggregateCall, Calculation, FnCall } from '../plan/operators/index.js';
import { OpOrId, PlanOperator, PlanVisitor } from '../plan/visitor.js';
import { ArgMeta, CalculationParams } from '../visitors/calculation-builder.js';
import { EqualityChecker } from '../visitors/equality-checker.js';

export function idToCalculation(id: ASTIdentifier, lang: Lowercase<string>) {
  const fn = new FnCall(lang, [id], ret1);
  return new Calculation(
    lang,
    ret1,
    [id],
    [
      {
        originalLocations: [{ obj: fn.args, key: 0, idAsFnArg: true, op: fn }],
      },
    ],
    fn,
    [],
    false,
  );
}

export function simplifyCalcParams(
  params: CalculationParams,
  eqCheckers: Record<string, EqualityChecker>,
  calcLang: Lowercase<string>,
): CalculationParams {
  if (params.args.length === 0) return params;
  const uniqueArgs: OpOrId[] = [params.args[0]];
  const argMeta: (ArgMeta | undefined)[] = [params.argMeta[0]];
  const indices: number[] = [0];
  outer: for (let i = 1; i < params.args.length; i++) {
    const eqChecker =
      eqCheckers[
        params.args[i] instanceof ASTIdentifier
          ? calcLang
          : (params.args[i] as PlanOperator).lang
      ];
    for (let j = 0; j < i; j++) {
      if (uniqueArgs[j] && eqChecker.areEqual(params.args[i], uniqueArgs[j])) {
        indices.push(j);
        argMeta[j].usedMultipleTimes = true;
        // original locations set always when the arg is an identifier
        argMeta[j].originalLocations.push(
          ...params.argMeta[i].originalLocations,
        );
        argMeta[j].maybeSkipped &&= params.argMeta[i]?.maybeSkipped;
        continue outer;
      }
    }
    uniqueArgs.push(params.args[i]);
    indices.push(uniqueArgs.length - 1);
    argMeta.push(params.argMeta[i]);
  }

  if (uniqueArgs.length === params.args.length) return params;
  const ret: CalculationParams = {
    args: uniqueArgs,
    impl: (...args: unknown[]) => {
      const mapped: unknown[] = [];
      for (const i of indices) {
        mapped.push(args[i]);
      }
      return params.impl.apply(null, mapped);
    },
    argMeta,
    literal: params.literal,
  };
  if (params.aggregates?.length) {
    ret.aggregates = argMeta
      .filter((a) => a?.aggregate instanceof AggregateCall)
      .map((a) => a.aggregate) as AggregateCall[];
  }
  return ret;
}

export function intermediateToCalc(
  op: PlanOperator,
  calcBuilders: Record<string, PlanVisitor<CalculationParams>>,
  eqCheckers: Record<string, EqualityChecker>,
): Calculation {
  let calcParams = op.accept(calcBuilders);
  calcParams = simplifyCalcParams(calcParams, eqCheckers, op.lang);
  const res = new Calculation(
    op.lang,
    calcParams.impl,
    calcParams.args,
    calcParams.argMeta,
    op,
    calcParams.aggregates,
    calcParams.literal,
  );
  res.cacheITCVisitors(calcBuilders, eqCheckers);
  return res;
}
