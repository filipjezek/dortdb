import { DortDBAsFriend } from '../../db.js';
import {
  Calculation,
  CartesianProduct,
  Join,
  ProjectionConcat,
} from '../../plan/operators/index.js';
import { LogicalPlanOperator } from '../../plan/visitor.js';
import { containsAny } from '../../utils/trie.js';
import { TransitiveDependencies } from '../../visitors/transitive-deps.js';
import { PatternRule, PatternRuleMatchResult } from '../rule.js';

export const removeEmptyProjConcat: PatternRule<ProjectionConcat> = {
  operator: ProjectionConcat,
  match(operator) {
    if (!operator.mapping.schema.length) {
      return { bindings: {} };
    }
    return null;
  },
  transform(operator, bindings) {
    return operator.source;
  },
};

export class ProjConcatToJoin implements PatternRule<ProjectionConcat> {
  public operator = ProjectionConcat;
  protected tdepsVmap: Record<string, TransitiveDependencies>;

  constructor(protected db: DortDBAsFriend) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
  }
  match(node: ProjectionConcat): PatternRuleMatchResult<unknown> {
    const tdeps = node.mapping.accept(this.tdepsVmap);
    if (!containsAny(tdeps, node.source.schema)) {
      return { bindings: {} };
    }
    return null;
  }
  transform(node: ProjectionConcat, bindings: any): LogicalPlanOperator {
    let res: CartesianProduct;
    if (node.outer) {
      res = new Join(
        node.lang,
        node.source,
        node.mapping,
        new Calculation(node.lang, () => true, [], []),
      );
      (res as Join).leftOuter = true;
    } else {
      res = new CartesianProduct(node.lang, node.source, node.mapping);
    }
    res.validateSingleValue = node.validateSingleValue;
    return res;
  }
}
