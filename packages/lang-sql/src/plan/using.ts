import {
  ASTIdentifier,
  IdSet,
  PlanOperator,
  PlanTupleOperator,
} from '@dortdb/core';
import { Join, Projection, Selection } from '@dortdb/core/plan';
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
  /** Trie of attribute identifiers excluded from the output schema: the left- and right-qualified forms of the USING columns. */
  public toRemove: IdSet;
  /** Left-qualified versions of {@link columns}, computed by {@link calculateSchema} and used by {@link SchemaInferrer} to build the equi-join condition. */
  public overriddenCols: ASTIdentifier[];

  constructor(
    lang: Lowercase<string>,
    /** Column names shared by both sides of the join as specified in the USING clause. */
    public columns: ASTIdentifier[],
    /** Relation name of the left side of the join; used to qualify {@link overriddenCols}. */
    public leftName: ASTIdentifier,
    /** Relation name of the right side of the join; its USING columns are included in {@link toRemove}. */
    public rightName: ASTIdentifier,
    /** The underlying join or Cartesian product operator. */
    public source: CartesianProduct | Join,
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<string | symbol>();
    this.calculateSchema();
    source.parent = this;
  }
  /** Dispatches this operator to the SQL plan visitor. */
  accept<Ret, Arg>(
    visitors: Record<string, SQLPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitUsing(this, arg);
  }
  /** Replaces the source, then recomputes the schema via {@link calculateSchema}. */
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    this.source = replacement as CartesianProduct;
    this.clearSchema();
    this.calculateSchema();
  }
  /** Returns `[source]`. */
  override getChildren(): PlanOperator[] {
    return [this.source];
  }

  /**
   * Recomputes {@link overriddenCols}, {@link toRemove}, and the operator schema
   * from the current {@link source} schema.
   */
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

  /** Returns a deep copy. */
  clone(): Using {
    const res = new Using(
      this.lang,
      this.columns.slice(),
      this.leftName,
      this.rightName,
      this.source.clone(),
    );
    return res;
  }
}
