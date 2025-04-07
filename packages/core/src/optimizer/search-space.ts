import { LogicalPlanOperator } from '../plan/visitor.js';
import { stableHash } from 'stable-hash';

export class SearchSpace {
  private mexprMap = new Map<string, MultiExpression>();

  public addExpr(expr: LogicalPlanOperator, group?: Group): MultiExpression {
    const h = stableHash(expr);
    if (this.mexprMap.has(h)) {
      const registered = this.mexprMap.get(h);
      if (group) {
        this.mergeGroups(group, registered.containerGroup);
      }
      return registered;
    }

    const mexpr = new MultiExpression(expr);
    const inputs = expr.getChildren();
    for (const input of inputs) {
      mexpr.inputs.push(this.findOrCreateGroup(input));
    }
    if (!group) {
      group = new Group();
    }
    mexpr.containerGroup = group;
    group.multiExprs.push(mexpr);
    this.mexprMap.set(h, mexpr);
    return mexpr;
  }

  private findOrCreateGroup(expr: LogicalPlanOperator): Group {
    const h = stableHash(expr);
    if (this.mexprMap.has(h)) {
      return this.mexprMap.get(h).containerGroup;
    }

    const group = new Group();
    const mexpr = new MultiExpression(expr);
    mexpr.containerGroup = group;
    group.multiExprs.push(mexpr);
    this.mexprMap.set(h, mexpr);
    return group;
  }

  private mergeGroups(target: Group, alt: Group): void {
    if (target === alt) return;
    target.lowerBound = Math.min(target.lowerBound, alt.lowerBound);
    target.multiExprs.push(...alt.multiExprs);
    target.explored = target.explored || alt.explored;
    for (const mexpr of alt.multiExprs) {
      mexpr.containerGroup = target;
      if (!mexpr.operator.parent) continue;
      const parent = this.mexprMap.get(stableHash(mexpr.operator.parent));
      for (let i = 0; i < parent.inputs.length; ++i) {
        if (parent.inputs[i] === alt) {
          parent.inputs[i] = target;
          break;
        }
      }
    }
  }
}

export class Group {
  public lowerBound = 0;
  public multiExprs: MultiExpression[] = [];
  public winner: { mexpr: MultiExpression; cost: number } = null;
  public explored = false;
  public cardinality: number;
}

export class MultiExpression {
  inputs: Group[];
  containerGroup: Group;
  rulesApplied: boolean[] = [];

  constructor(public operator: LogicalPlanOperator) {}
}
