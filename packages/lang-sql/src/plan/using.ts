import {
  ASTIdentifier,
  IdSet,
  PlanOperator,
  PlanTupleOperator,
} from '@dortdb/core';
import { Projection, Selection } from '@dortdb/core/plan';
import { SchemaInferrer } from '../visitors/schema-inferrer.js';
import { Trie } from '@dortdb/core/data-structures';
import { CartesianProduct } from '@dortdb/core/plan';
import { overrideSource, schemaToTrie } from '@dortdb/core/utils';
import { SQLPlanVisitor } from './index.js';

/**
 * This operator is a temporary operator which is replaced by {@link Projection} and {@link Selection}
 * in {@link SchemaInferrer}.
 */
export class Using extends PlanTupleOperator {
  public toRemove: IdSet;
  public overriddenCols: ASTIdentifier[];

  constructor(
    lang: Lowercase<string>,
    public columns: ASTIdentifier[],
    public leftName: ASTIdentifier,
    public rightName: ASTIdentifier,
    public source: CartesianProduct,
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<string | symbol>();
    this.calculateSchema();
    source.parent = this;
  }
  accept<Ret, Arg>(
    visitors: Record<string, SQLPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitUsing(this, arg);
  }
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    this.source = replacement as CartesianProduct;
    this.clearSchema();
    this.calculateSchema();
  }
  override getChildren(): PlanOperator[] {
    return [this.source];
  }

  calculateSchema(): void {
    this.overriddenCols = this.columns.map((c) =>
      overrideSource(this.leftName, c),
    );
    this.toRemove = schemaToTrie(this.overriddenCols);
    for (const col of this.columns) {
      this.toRemove.add(overrideSource(this.rightName, col).parts);
    }
    this.addToSchema(
      this.source.schema.filter((s) => !this.toRemove.has(s.parts)),
    );
    this.addToSchema(this.columns);
  }
}
