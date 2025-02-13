import {
  ASTIdentifier,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
  operators,
  utils,
} from '@dortdb/core';
import { SchemaInferrer } from '../visitors/schema-inferrer.js';
import { Trie } from 'mnemonist';

/**
 * This operator is a temporary operator which is replaced by {@link operators.Projection} and {@link operators.Selection}
 * in {@link SchemaInferrer}.
 */
export class Using extends LogicalPlanTupleOperator {
  public toRemove: Trie<(string | symbol)[]>;
  public overriddenCols: ASTIdentifier[];

  constructor(
    public lang: Lowercase<string>,
    public columns: ASTIdentifier[],
    public leftName: ASTIdentifier,
    public rightName: ASTIdentifier,
    public source: operators.CartesianProduct
  ) {
    super();
    this.schema = [];
    this.schemaSet = new Trie<(string | symbol)[]>(Array);
    this.calculateSchema();
    source.parent = this;
  }
  accept<T>(
    visitors: Record<
      string,
      LogicalPlanVisitor<T> & { visitUsing: (op: Using) => T }
    >
  ): T {
    return visitors[this.lang].visitUsing(this);
  }
  replaceChild(
    current: LogicalPlanTupleOperator,
    replacement: LogicalPlanTupleOperator
  ): void {
    this.source = replacement as operators.CartesianProduct;
    this.clearSchema();
    this.calculateSchema();
  }

  calculateSchema(): void {
    this.overriddenCols = this.columns.map((c) =>
      utils.overrideSource(this.leftName, c)
    );
    this.toRemove = utils.schemaToTrie(this.overriddenCols);
    for (const col of this.columns) {
      this.toRemove.add(utils.overrideSource(this.rightName, col).parts);
    }
    this.addToSchema(
      this.source.schema.filter((s) => !this.toRemove.has(s.parts))
    );
    this.addToSchema(this.columns);
  }
}
