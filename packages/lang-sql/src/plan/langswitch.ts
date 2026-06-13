import { ASTIdentifier, PlanOperator, PlanTupleOperator } from '@dortdb/core';
import { LangSwitch as ASTLangSwitch } from '@dortdb/core';
import { Trie } from '@dortdb/core/data-structures';
import { SQLPlanVisitor } from './index.js';
import { type SchemaInferrer } from '../visitors/schema-inferrer.js';
import { SQLLangCtx } from '../visitors/builder.js';

/**
 * This operator is a temporary operator which is replaced in {@link SchemaInferrer}.
 */
export class LangSwitch extends PlanTupleOperator {
  /**
   * IN optimization needs information about the first returned column. The
   * schema is not known at that point, so we create a new column which is required to be
   * returned by the subquery.
   */
  public requiredCol: ASTIdentifier;

  constructor(
    lang: Lowercase<string>,
    /** The AST node containing the embedded language-switch expression. */
    public node: ASTLangSwitch,
    /** Shared cross-language context; the `sql` entry holds the current {@link SQLLangCtx}. */
    public langCtx: Record<string, unknown> & {
      /** The SQL-specific language context for the current query scope. */
      sql: SQLLangCtx;
    },
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<string | symbol>();
  }
  /** Dispatches this operator to the SQL plan visitor for the active language. */
  accept<Ret, Arg>(
    visitors: Record<string, SQLPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitLangSwitch(this, arg);
  }
  /**
   * Not supported — a {@link LangSwitch} has no plan children.
   *
   * @throws Always throws; replace the operator itself rather than its children.
   */
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    throw new Error('Method not implemented.');
  }
  /** Returns an empty array; a {@link LangSwitch} has no plan children. */
  override getChildren(): PlanOperator[] {
    return [];
  }
  /** Returns a deep copy of this operator including schema, schema set, and {@link requiredCol}. */
  clone(): LangSwitch {
    const res = new LangSwitch(this.lang, this.node, this.langCtx);
    res.schema = this.schema.slice();
    res.schemaSet = this.schemaSet.clone();
    res.requiredCol = this.requiredCol;
    return res;
  }
}
