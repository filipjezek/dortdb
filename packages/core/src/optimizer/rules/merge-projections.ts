import { PatternRule, PatternRuleMatchResult } from '../rule.js';
import * as plan from '../../plan/operators/index.js';
import {
  IdSet,
  LogicalOpOrId,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../../plan/visitor.js';
import { Trie } from '../../data-structures/trie.js';
import { ASTIdentifier } from '../../ast.js';
import { DortDBAsFriend } from '../../db.js';
import { TransitiveDependencies } from '../../visitors/transitive-deps.js';
import { union } from '../../utils/trie.js';
import { isCalc } from '../../internal-fns/index.js';
import {
  CalculationParams,
  simplifyCalcParams,
} from '../../visitors/calculation-builder.js';

export type MergeProjectionsBindings = plan.Projection[];
export type ProjMap = Trie<string | symbol, ASTIdentifier | plan.Calculation>;

export class MergeProjections
  implements PatternRule<plan.Projection, MergeProjectionsBindings>
{
  operator = plan.Projection;
  protected tdepsVmap: Record<string, TransitiveDependencies>;
  protected calcBuilderVmap: Record<
    string,
    LogicalPlanVisitor<CalculationParams>
  >;

  constructor(protected db: DortDBAsFriend) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
    this.calcBuilderVmap = this.db.langMgr.getVisitorMap('calculationBuilder');
  }

  match(
    node: plan.Projection,
  ): PatternRuleMatchResult<MergeProjectionsBindings> {
    if (node.parent.constructor === plan.Projection) return null; // already handled
    const bindings: plan.Projection[] = [node];
    while (node.source.constructor === plan.Projection) {
      bindings.push(node.source as plan.Projection);
      node = node.source as plan.Projection;
    }
    return bindings.length > 1 ? { bindings } : null;
  }

  transform(
    node: plan.Projection,
    bindings: MergeProjectionsBindings,
  ): LogicalPlanOperator {
    let last = node;
    for (let i = 1; i < bindings.length; i++) {
      last = this.mergeProjections(last, bindings[i]);
    }
    this.tdepsVmap[node.lang].clearCache();
    return node;
  }

  protected mergeProjections(
    a: plan.Projection,
    b: plan.Projection,
  ): plan.Projection {
    const projMap: ProjMap = new Trie();
    const calcInputDeps = new Map<plan.Calculation, IdSet>(
      a.attrs
        .filter((x) => x[0] instanceof plan.Calculation)
        .map((x) => [
          x[0] as plan.Calculation,
          this.getCalcInputDeps(x[0] as plan.Calculation),
        ]),
    );
    const [canMerge, usedAttrs] = this.canMergeIntoOne(
      a,
      b,
      projMap,
      calcInputDeps,
    );

    if (!canMerge) {
      b = new plan.Projection(b.lang, usedAttrs, b.source);
      b.parent = a;
      a.source = b;
      return b;
    }
    a.source = b.source;
    b.source.parent = a;
    for (const attr of a.attrs) {
      if (attr[0] instanceof plan.Calculation) {
        attr[0] = this.getNewCalc(attr[0], projMap);
      } else {
        attr[0] = projMap.get(attr[0].parts) ?? attr[0];
      }
      if (attr[0] instanceof plan.Calculation) {
        attr[0].parent = a;
      }
    }
    return a;
  }

  protected calcToFnCall(
    calc: plan.Calculation,
    args: LogicalOpOrId[],
  ): plan.FnCall {
    return new plan.FnCall(
      calc.lang,
      args.map((arg, i) => {
        const meta = calc.argMeta[i];
        if (meta?.aggregate) {
          return {
            op: meta.aggregate,
            acceptSequence: meta.acceptSequence,
          };
        }
        if (arg instanceof ASTIdentifier) return arg;
        return { op: arg, acceptSequence: meta.acceptSequence };
      }),
      calc.impl,
      calc.literal,
    );
  }

  protected getNewCalc(
    calc: plan.Calculation,
    projMap: ProjMap,
  ): plan.Calculation {
    const fnArgs = calc.args.map((arg, i) => {
      if (arg instanceof ASTIdentifier) {
        arg = projMap.get(arg.parts) ?? arg;
        if (arg instanceof plan.Calculation) {
          calc.argMeta[i] ??= {};
          return this.calcToFnCall(arg, arg.args);
        }
      }
      return arg;
    });
    const fn = this.calcToFnCall(calc, fnArgs);
    const newCalcParams = simplifyCalcParams(fn.accept(this.calcBuilderVmap));

    const invMetaMap = new Map(newCalcParams.args.map((x, i) => [x, i]));
    for (let i = 0; i < fnArgs.length; i++) {
      if (fnArgs[i] instanceof plan.FnCall) {
        const original = projMap.get(
          (calc.args[i] as ASTIdentifier).parts,
        ) as plan.Calculation;
        for (let j = 0; j < original.args.length; j++) {
          const arg = original.args[j];
          if (
            original.argMeta[j]?.usedMultipleTimes ||
            calc.argMeta[i]?.usedMultipleTimes
          ) {
            const revIndex = invMetaMap.get(arg);
            newCalcParams.argMeta[revIndex] ??= {};
            newCalcParams.argMeta[revIndex].usedMultipleTimes = true;
          }
        }
      } else if (calc.argMeta[i]?.usedMultipleTimes) {
        const revIndex = invMetaMap.get(fnArgs[i]);
        newCalcParams.argMeta[revIndex] ??= {};
        newCalcParams.argMeta[revIndex].usedMultipleTimes = true;
      }
    }
    const newCalc = new plan.Calculation(
      calc.lang,
      newCalcParams.impl,
      newCalcParams.args,
      newCalcParams.argMeta,
      newCalcParams.aggregates,
      newCalcParams.literal,
    );
    return newCalc;
  }

  protected canMergeIntoOne(
    a: plan.Projection,
    b: plan.Projection,
    projMap: ProjMap,
    calcInputDeps: Map<plan.Calculation, IdSet>,
  ): [boolean, [plan.Calculation | ASTIdentifier, ASTIdentifier][]] {
    let canMerge = true;
    const usedAttrs = b.attrs.filter(([value, alias]) => {
      let usedTimes = 0;
      for (const [aVal, aAlias] of a.attrs) {
        if (aVal instanceof plan.Calculation) {
          if (calcInputDeps.get(aVal).has(alias.parts)) {
            canMerge = false;
            return true;
          }
          if (aVal.dependencies.has(alias.parts)) {
            const metaIndex = aVal.args.findIndex(
              (x) => x instanceof ASTIdentifier && x.equals(alias),
            );
            usedTimes += aVal.argMeta[metaIndex]?.usedMultipleTimes ? 2 : 1;
            if (usedTimes > 1 && value instanceof plan.Calculation) {
              canMerge = false;
              return true;
            }
            projMap.set(alias.parts, value);
          }
        } else if (aVal.equals(alias)) {
          usedTimes++;
          if (usedTimes > 1 && value instanceof plan.Calculation) {
            canMerge = false;
            return true;
          }
          projMap.set(alias.parts, value);
        }
      }
      return usedTimes > 0;
    });
    return [canMerge, usedAttrs];
  }

  protected getCalcInputDeps(calc: plan.Calculation): IdSet {
    return union(
      ...calc.args.filter(isCalc).map((inp) => inp.accept(this.tdepsVmap)),
    );
  }
}
