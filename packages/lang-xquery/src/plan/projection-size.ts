import { ASTIdentifier, PlanOperator, PlanTupleOperator } from '@dortdb/core';
import { XQueryPlanVisitor } from './index.js';
import { schemaToTrie } from '@dortdb/core/utils';

/**
 * Plan operator that computes the sequence length for each group of tuples and
 * appends it as {@link sizeCol}, making the XQuery `fn:last()` context value
 * available downstream.
 */
export class ProjectionSize extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** Column identifier that receives the computed sequence length. */
    public sizeCol: ASTIdentifier,
    /** The upstream tuple stream whose tuples are grouped and sized. */
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = [...source.schema.filter((x) => !x.equals(sizeCol)), sizeCol];
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
  }

  /** Dispatches to `visitors[this.lang].visitProjectionSize`. */
  accept<Ret, Arg>(
    visitors: Record<string, XQueryPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjectionSize(this, arg);
  }
  /** Swaps `source` and recomputes the output schema, preserving `sizeCol` as the last column. */
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    this.source = replacement;
    this.clearSchema();
    this.addToSchema(replacement.schema.filter((x) => !x.equals(this.sizeCol)));
    this.addToSchema(this.sizeCol);
  }
  /** Returns `[this.source]`. */
  override getChildren(): PlanOperator[] {
    return [this.source];
  }
  /** Returns a deep copy with a cloned source. */
  clone(): ProjectionSize {
    return new ProjectionSize(this.lang, this.sizeCol, this.source.clone());
  }
}
