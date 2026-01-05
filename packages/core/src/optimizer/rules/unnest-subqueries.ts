import { PatternRule, PatternRuleMatchResult } from '../rule.js';
import * as plan from '../../plan/operators/index.js';
import {
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../../plan/visitor.js';
import { ASTIdentifier } from '../../ast.js';
import { TransitiveDependencies } from '../../visitors/transitive-deps.js';
import { DortDBAsFriend } from '../../db.js';
import {
  assertMaxOne,
  isNotNull,
  ret1,
  toPair,
} from '../../internal-fns/index.js';
import { simplifyCalcParams } from '../../utils/calculation.js';
import { EqualityChecker } from '../../visitors/equality-checker.js';
import { CalculationParams } from '../../visitors/calculation-builder.js';

export interface UnnestSubqueriesBindings {
  subqueries: [plan.Calculation, number[]][];
}

export const unnestedAttr = Symbol('unnested');

/**
 * Replaces eligible nested operators with {@link plan.ProjectionConcat}.
 */
export class UnnestSubqueries implements PatternRule<
  PlanTupleOperator & { source: PlanTupleOperator },
  UnnestSubqueriesBindings
> {
  operator = [
    plan.Projection,
    plan.Selection,
    plan.GroupBy,
    plan.Distinct,
    plan.OrderBy,
  ];

  protected tdepsVmap: Record<string, TransitiveDependencies>;
  protected calcBuilders: Record<string, PlanVisitor<CalculationParams>>;
  protected eqCheckers: Record<string, EqualityChecker>;

  constructor(protected db: DortDBAsFriend) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
    this.calcBuilders = this.db.langMgr.getVisitorMap('calculationBuilder');
    this.eqCheckers = this.db.langMgr.getVisitorMap('equalityChecker');
  }

  match(
    node: PlanTupleOperator & { source: PlanTupleOperator },
  ): PatternRuleMatchResult<UnnestSubqueriesBindings> {
    const calcs = node
      .getChildren()
      .map((child) => {
        if (!(child instanceof plan.Calculation && child.original)) return null;
        const subqs = child.args
          .map((arg, i) => {
            if (arg instanceof ASTIdentifier) return null;
            const meta = child.argMeta[i];
            return !meta.acceptSequence && !meta.maybeSkipped ? i : null;
          })
          .filter(isNotNull);
        return subqs.length
          ? ([child, subqs] as [plan.Calculation, number[]])
          : null;
      })
      .filter(isNotNull);
    return calcs.length ? { bindings: { subqueries: calcs } } : null;
  }
  transform(
    node: PlanTupleOperator & { source: PlanTupleOperator },
    bindings: UnnestSubqueriesBindings,
  ): PlanOperator {
    let newAttrCounter = 0;
    const tdeps = this.tdepsVmap[node.lang];
    tdeps.invalidateCacheElement(node);
    const restrictedAttrs = node.schema.map(toPair);

    for (const [calc, subqs] of bindings.subqueries) {
      tdeps.invalidateCacheElement(calc);
      for (const i of subqs) {
        const newAttr = ASTIdentifier.fromParts([
          unnestedAttr,
          newAttrCounter++ + '',
        ]);
        const subq = calc.args[i] as PlanOperator;
        this.removeSubq(calc, i, newAttr);

        const projConcat = new plan.ProjectionConcat(
          node.lang,
          new plan.MapFromItem(node.lang, newAttr, subq),
          !this.isGuaranteedValue(subq),
          node.source,
        );
        projConcat.parent = node;
        node.source = projConcat;
        projConcat.validateSingleValue = true;
        if (!(node instanceof plan.Projection)) {
          node.addToSchema(newAttr);
        }
      }
    }
    tdeps.clearCache();
    return new plan.Projection(node.lang, restrictedAttrs, node);
  }

  protected removeSubq(
    calc: plan.Calculation,
    argI: number,
    newAttr: ASTIdentifier,
  ): void {
    this.tdepsVmap[calc.lang].invalidateCacheUpstream(
      calc.args[argI] as PlanOperator,
    );
    if (calc.impl === assertMaxOne) {
      (
        calc.parent as
          | plan.Projection
          | plan.Selection
          | plan.GroupBy
          | plan.Distinct
          | plan.OrderBy
      ).replaceChild(calc, newAttr);
    } else {
      calc.replaceChild(
        calc.args[argI] as plan.Calculation,
        new plan.FnCall(calc.lang, [newAttr], ret1),
      );
      let newParams = calc.original.accept(this.calcBuilders);
      newParams = simplifyCalcParams(newParams, this.eqCheckers, calc.lang);
      calc.impl = newParams.impl;
      calc.aggregates = newParams.aggregates;
      calc.argMeta = newParams.argMeta;
      calc.dependencies.add(newAttr.parts);
      calc.literal = newParams.literal;
      calc.args = newParams.args;
    }
  }

  protected isGuaranteedValue(node: PlanOperator): boolean {
    switch (node.constructor) {
      case plan.MapToItem:
      case plan.MapFromItem:
      case plan.Projection:
      case plan.ProjectionIndex:
      case plan.OrderBy:
        return this.isGuaranteedValue((node as any).source);
      case plan.Union:
        return (
          this.isGuaranteedValue((node as any).left) ||
          this.isGuaranteedValue((node as any).right)
        );
      case plan.CartesianProduct:
        return (
          this.isGuaranteedValue((node as any).left) &&
          this.isGuaranteedValue((node as any).right)
        );
      case plan.ProjectionConcat:
        return (node as plan.ProjectionConcat).outer
          ? this.isGuaranteedValue((node as plan.ProjectionConcat).source)
          : false;
      case plan.Join: {
        const n = node as plan.Join;
        if (!n.leftOuter && !n.rightOuter) return false;
        if (n.leftOuter && n.rightOuter) return true;
        const child = n.leftOuter ? n.left : n.right;
        return this.isGuaranteedValue(child);
      }
      case plan.Limit:
        return (
          !(node as plan.Limit).skip &&
          ((node as plan.Limit).limit ?? Infinity) > 0 &&
          this.isGuaranteedValue((node as plan.Limit).source)
        );
      case plan.NullSource:
        return true;
      case plan.GroupBy:
        return (
          !(node as plan.GroupBy).keys.length ||
          this.isGuaranteedValue((node as plan.GroupBy).source)
        );
      default:
        return false;
    }
  }
}
