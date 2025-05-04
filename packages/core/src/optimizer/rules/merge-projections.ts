import { PatternRule, PatternRuleMatchResult } from '../rule.js';
import * as plan from '../../plan/operators/index.js';
import {
  IdSet,
  OpOrId,
  PlanOperator,
  PlanVisitor,
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
import { EqualityChecker } from '../../visitors/equality-checker.js';

export type MergeProjectionsBindings = plan.Projection[];
export type ProjMap = Trie<string | symbol, ASTIdentifier | plan.Calculation>;

export class MergeProjections
  implements PatternRule<plan.Projection, MergeProjectionsBindings>
{
  operator = plan.Projection;
  protected tdepsVmap: Record<string, TransitiveDependencies>;
  protected calcBuilderVmap: Record<string, PlanVisitor<CalculationParams>>;
  protected eqCheckersVmap: Record<string, EqualityChecker>;

  constructor(protected db: DortDBAsFriend) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
    this.calcBuilderVmap = this.db.langMgr.getVisitorMap('calculationBuilder');
    this.eqCheckersVmap = this.db.langMgr.getVisitorMap('equalityChecker');
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
  ): PlanOperator {
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

  protected calcToFnCall(calc: plan.Calculation, args: OpOrId[]): plan.FnCall {
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
    console.log(calc.args, calc.argMeta);
    for (let i = 0; i < calc.args.length; i++) {
      const arg = calc.args[i];
      if (arg instanceof ASTIdentifier) {
        const mapped = projMap.get(arg.parts);
        if (mapped) {
          for (const [obj, key] of calc.argMeta[i].originalLocations) {
            if (mapped instanceof plan.Calculation) {
              obj[key] = mapped.original;
            } else {
              obj[key] = mapped;
            }
          }
        }
      }
    }

    const newCalcParams = simplifyCalcParams(
      calc.original.accept(this.calcBuilderVmap),
      this.eqCheckersVmap,
      calc.lang,
    );
    const newCalc = new plan.Calculation(
      calc.lang,
      newCalcParams.impl,
      newCalcParams.args,
      newCalcParams.argMeta,
      calc.original,
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
          if (!aVal.original) canMerge = false;
          if (calcInputDeps.get(aVal).has(alias.parts)) {
            canMerge = false;
            return true;
          }
          if (aVal.dependencies.has(alias.parts)) {
            const metaIndex = aVal.args.findIndex(
              (x) => x instanceof ASTIdentifier && x.equals(alias),
            );
            usedTimes += aVal.argMeta[metaIndex]?.usedMultipleTimes ? 2 : 1;
            if (value instanceof plan.Calculation) {
              if (!value.original) canMerge = false;
              if (usedTimes > 1) {
                canMerge = false;
                return true;
              }
            }
            projMap.set(alias.parts, value);
          }
        } else if (aVal.equals(alias)) {
          usedTimes++;
          if (value instanceof plan.Calculation) {
            if (!value.original) canMerge = false;
            if (usedTimes > 1) {
              canMerge = false;
              return true;
            }
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
