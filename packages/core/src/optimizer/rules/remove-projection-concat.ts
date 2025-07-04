import { DortDBAsFriend } from '../../db.js';
import {
  CartesianProduct,
  Join,
  ProjectionConcat,
} from '../../plan/operators/index.js';
import { PlanOperator } from '../../plan/visitor.js';
import { containsAny } from '../../utils/trie.js';
import { TransitiveDependencies } from '../../visitors/transitive-deps.js';
import { PatternRule, PatternRuleMatchResult } from '../rule.js';

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
  transform(node: ProjectionConcat, bindings: any): PlanOperator {
    let res: CartesianProduct;
    if (node.outer) {
      res = new Join(node.lang, node.source, node.mapping, []);
      (res as Join).leftOuter = true;
    } else {
      res = new CartesianProduct(node.lang, node.source, node.mapping);
    }
    res.validateSingleValue = node.validateSingleValue;
    return res;
  }
}
