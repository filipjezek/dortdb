import { ASTIdentifier, PlanOperator, PlanTupleOperator } from '@dortdb/core';
import { LangSwitch, SQLPlanVisitor } from './index.js';
import { overrideSource, schemaToTrie } from '@dortdb/core/utils';
import { TupleFnSource, TupleSource } from '@dortdb/core/plan';

/**
 * Plan operator that renames all attributes of a table or function source
 * under a single alias, making them addressable as `alias.column`.
 *
 * @remarks Replaced in-place by a {@link Projection} during schema inference
 * (see {@link SchemaInferrer.visitTableAlias}).
 */
export class TableAlias extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** The identifier used as the new relation name for all output attributes. */
    public alias: ASTIdentifier,
    /** The underlying tuple source being aliased. */
    public source: TupleFnSource | TupleSource | LangSwitch,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema.map((attr) => overrideSource(alias, attr));
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
  }
  /** Dispatches this operator to the SQL plan visitor. */
  accept<Ret, Arg>(
    visitors: Record<string, SQLPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTableAlias(this, arg);
  }
  /** Replaces the current source with `replacement`. */
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    this.source = replacement as TupleFnSource | TupleSource | LangSwitch;
  }
  /** Returns `[source]`. */
  override getChildren(): PlanOperator[] {
    return [this.source];
  }
  /** Returns a deep copy with a cloned source and copied schema. */
  clone(): TableAlias {
    const res = new TableAlias(this.lang, this.alias, this.source.clone());
    res.schema = this.schema.slice();
    res.schemaSet = this.schemaSet.clone();
    return res;
  }
}
