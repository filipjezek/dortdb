import {
  CartesianProduct,
  Join,
  Selection,
} from '../../plan/operators/index.js';
import { PlanOperator } from '../../plan/visitor.js';
import { PatternRule, PatternRuleMatchResult } from '../rule.js';

export interface ProductsToJoinsBindings {
  selections: Selection[];
  product: CartesianProduct;
}

/**
 * Converts a Cartesian product of selections into a join operator.
 */
export const productsToJoins: PatternRule<Selection, ProductsToJoinsBindings> =
  {
    operator: Selection,
    match: function (
      node: Selection,
    ): PatternRuleMatchResult<ProductsToJoinsBindings> {
      const bindings: ProductsToJoinsBindings = {
        selections: [node],
        product: null,
      };
      while (node.source.constructor === Selection) {
        bindings.selections.push(node.source as Selection);
        node = node.source as Selection;
      }
      if (node.source.constructor === CartesianProduct) {
        bindings.product = node.source as CartesianProduct;
      } else {
        return null;
      }
      return { bindings };
    },
    transform: function (
      node: Selection,
      bindings: ProductsToJoinsBindings,
    ): PlanOperator {
      return new Join(
        bindings.product.lang,
        bindings.product.left,
        bindings.product.right,
        bindings.selections.map((s) => s.condition),
      );
    },
  };
