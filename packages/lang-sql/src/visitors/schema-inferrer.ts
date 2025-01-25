import {
  ASTIdentifier,
  LanguageManager,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
  operators,
  utils,
} from '@dortdb/core';
import { Trie } from 'mnemonist';
import { isTableAttr } from '../utils/is-table-attr.js';

const EMPTY = new Trie<(string | symbol)[]>(Array);

/**
 * Infers the schema of a logical plan.
 * Each method returns external references.
 */
export class SchemaInferrer
  implements LogicalPlanVisitor<Trie<(string | symbol)[]>>
{
  constructor(
    private vmap: Record<string, LogicalPlanVisitor<Trie<(string | symbol)[]>>>,
    private langMgr: LanguageManager
  ) {}

  /**
   * conditional down traversal. Only use if the source can be a langswitch
   */
  private downCond(v: LogicalPlanOperator & { source: LogicalPlanOperator }) {
    if (v.source.lang === 'sql') {
      return v.source.accept(this.vmap);
    }
    return EMPTY;
  }

  visitProjection(operator: operators.Projection): Trie<(string | symbol)[]> {
    // additional appended attrs through upper operators
    const external = utils.schemaToTrie(
      operator.schema.slice(operator.attrs.length)
    );
    operator.removeFromSchema(external);

    for (const attr of operator.attrs) {
      this.processArg(operator.source, attr[0]);
    }
    for (const item of this.downCond(operator)) {
      external.add(item);
    }
    return external;
  }

  private processArg(
    operator: LogicalPlanTupleOperator,
    arg: ASTIdentifier | LogicalPlanOperator
  ) {
    if (arg instanceof ASTIdentifier) {
      operator.addToSchema(arg);
    } else {
      operator.addToSchema(arg.accept(this.vmap));
    }
  }
  visitSelection(operator: operators.Selection): Trie<(string | symbol)[]> {
    this.processArg(operator, operator.condition);
    return operator.source.accept(this.vmap);
  }
  visitTupleSource(operator: operators.TupleSource): Trie<(string | symbol)[]> {
    const external = new Trie<(string | symbol)[]>(Array);
    const name =
      operator.name instanceof ASTIdentifier ? operator.name : operator.name[1];
    for (const attr of operator.schema) {
      if (attr.parts.length > 1 && !isTableAttr(attr, name)) {
        external.add(attr.parts);
      }
    }
    return external;
  }
  visitItemSource(operator: operators.ItemSource): Trie<(string | symbol)[]> {
    return EMPTY;
  }
  visitFnCall(operator: operators.FnCall): Trie<(string | symbol)[]> {
    throw new Error('Method not implemented.');
  }
  visitLiteral(operator: operators.Literal): Trie<(string | symbol)[]> {
    throw new Error('Method not implemented.');
  }
  visitCalculation(
    operator:
      | operators.Calculation
      | operators.ItemFnSource
      | operators.TupleFnSource
  ): Trie<(string | symbol)[]> {
    const external = new Trie<(string | symbol)[]>(Array);
    for (const arg of operator.args) {
      if (arg instanceof ASTIdentifier) {
        external.add(arg.parts);
      } else if (arg.lang === 'sql') {
        for (const item of arg.accept(this.vmap)) {
          external.add(item);
        }
      }
    }
    return external;
  }
  visitConditional(operator: operators.Conditional): Trie<(string | symbol)[]> {
    throw new Error('Method not implemented.');
  }

  private getRelName(operator: LogicalPlanTupleOperator) {
    // joins are made of either TupleSources or Projections based on table aliases
    if (operator instanceof operators.TupleSource) {
      return operator.name instanceof ASTIdentifier
        ? operator.name
        : operator.name[1];
    }
    return ASTIdentifier.fromParts(operator.schema[0].parts.slice(0, -1));
  }
  visitCartesianProduct(
    operator: operators.CartesianProduct
  ): Trie<(string | symbol)[]> {
    const external = new Trie<(string | symbol)[]>(Array);
    const leftName = this.getRelName(operator.left);
    const rightName = this.getRelName(operator.right);

    for (const item of operator.schema) {
      if (item.parts.length === 1) {
        throw new Error(`Ambiguous column name: ${item.parts[0]?.toString()}`);
      }
      if (isTableAttr(item, leftName)) {
        operator.left.addToSchema(item);
      } else if (isTableAttr(item, rightName)) {
        operator.right.addToSchema(item);
      } else {
        external.add(item.parts);
      }
    }
    operator.removeFromSchema(external);

    if (operator.left.lang === 'sql') {
      for (const item of operator.left.accept(this.vmap)) {
        external.add(item);
      }
    }
    if (operator.right.lang === 'sql') {
      for (const item of operator.right.accept(this.vmap)) {
        external.add(item);
      }
    }

    return external;
  }
  visitJoin(operator: operators.Join): Trie<(string | symbol)[]> {
    if (operator.on) {
      this.processArg(operator, operator.on);
    }
    return this.visitCartesianProduct(operator);
  }
  visitProjectionConcat(
    operator: operators.ProjectionConcat
  ): Trie<(string | symbol)[]> {
    const horizontal =
      operator.mapping.lang === 'sql'
        ? operator.mapping.accept(this.vmap)
        : EMPTY;
    operator.source.addToSchema(horizontal);
    const vertical = this.downCond(operator);
    operator.clearSchema();
    operator.addToSchema(
      operator.source.schema.concat(operator.mapping.schema)
    );
    return vertical;
  }
  visitMapToItem(operator: operators.MapToItem): Trie<(string | symbol)[]> {
    return this.downCond(operator);
  }
  visitMapFromItem(operator: operators.MapFromItem): Trie<(string | symbol)[]> {
    const external = this.downCond(operator);
    while (operator.schema.length > 1) {
      external.add(operator.schema[1].parts);
      operator.removeFromSchema(operator.schema[1]);
    }
    return external;
  }
  visitProjectionIndex(
    operator: operators.ProjectionIndex
  ): Trie<(string | symbol)[]> {
    const external = this.downCond(operator);
    operator.removeFromSchema(external);

    const index = operator.schema.indexOf(operator.indexCol);
    const temp = operator.schema[operator.schema.length - 1];
    operator.schema[index] = temp;
    operator.schema[operator.schema.length - 1] = operator.indexCol;

    return external;
  }
  visitOrderBy(operator: operators.OrderBy): Trie<(string | symbol)[]> {
    return operator.source.accept(this.vmap);
  }
  visitGroupBy(operator: operators.GroupBy): Trie<(string | symbol)[]> {
    // additional appended attrs through upper operators
    const external = utils.schemaToTrie(
      operator.schema.slice(operator.keys.length + operator.aggs.length)
    );
    operator.removeFromSchema(external);

    for (const attr of operator.keys) {
      this.processArg(operator.source, attr[0]);
    }
    for (const agg of operator.aggs) {
      for (const arg of agg.args) {
        this.processArg(operator.source, arg);
      }
      operator.source.addToSchema(agg.postGroupOp.accept(this.vmap));
    }
    for (const item of this.downCond(operator)) {
      external.add(item);
    }
    return external;
  }
  visitLimit(operator: operators.Limit): Trie<(string | symbol)[]> {
    return operator.source.accept(this.vmap);
  }

  private processSetOp(operator: operators.SetOperator) {
    const left =
      operator.left.lang === 'sql' ? operator.left.accept(this.vmap) : EMPTY;
    const right =
      operator.right.lang === 'sql' ? operator.right.accept(this.vmap) : EMPTY;
    for (const item of right) {
      left.add(item);
    }
    return left;
  }

  visitUnion(operator: operators.Union): Trie<(string | symbol)[]> {
    return this.processSetOp(operator);
  }
  visitIntersection(
    operator: operators.Intersection
  ): Trie<(string | symbol)[]> {
    return this.processSetOp(operator);
  }
  visitDifference(operator: operators.Difference): Trie<(string | symbol)[]> {
    return this.processSetOp(operator);
  }
  visitDistinct(operator: operators.Distinct): Trie<(string | symbol)[]> {
    return operator.source.accept(this.vmap);
  }
  visitNullSource(operator: operators.NullSource): Trie<(string | symbol)[]> {
    return EMPTY;
  }
  visitAggregate(operator: operators.AggregateCall): Trie<(string | symbol)[]> {
    throw new Error('Method not implemented.');
  }
  visitItemFnSource(
    operator: operators.ItemFnSource
  ): Trie<(string | symbol)[]> {
    return this.visitCalculation(operator);
  }
  visitTupleFnSource(
    operator: operators.TupleFnSource
  ): Trie<(string | symbol)[]> {
    return this.visitCalculation(operator);
  }
  visitQuantifier(operator: operators.Quantifier): Trie<(string | symbol)[]> {
    throw new Error('Method not implemented.');
  }
}
