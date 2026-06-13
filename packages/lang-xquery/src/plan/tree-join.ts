import { PlanOperator, PlanTupleOperator } from '@dortdb/core';
import { schemaToTrie } from '@dortdb/core/utils';
import { Calculation, ProjectionConcat } from '@dortdb/core/plan';
import { XQueryPlanVisitor } from './index.js';
import { DOT, LEN, POS } from '../utils/dot.js';

const ctxCols = [DOT, POS, LEN];

/**
 * Similar to {@link ProjectionConcat}, also provides xquery focus context.
 * The {@link Calculation} output in `step` will be spread into multiple output
 * tuples if it is an array. Removes duplicates of `Node` values.
 */
export class TreeJoin extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** The {@link Calculation} that produces the XPath step result for each context tuple. */
    public step: Calculation,
    /** The upstream tuple stream providing the XQuery focus context. */
    public source: PlanTupleOperator,
    /** When `true` (default), duplicate DOM nodes in the step result are removed. */
    public removeDuplicates = true,
  ) {
    super();
    this.lang = lang;
    source.parent = this;
    step.parent = this;
    this.schema = source.schema.slice();

    for (const col of ctxCols) {
      if (!source.schemaSet.has(col.parts)) this.schema.push(col);
    }
    this.schemaSet = schemaToTrie(this.schema);
  }
  /** Dispatches to `visitors[this.lang].visitTreeJoin`. */
  accept<Ret, Arg>(
    visitors: Record<string, XQueryPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTreeJoin(this, arg);
  }
  /** Swaps `source` or `step` and recomputes the output schema including XQuery context columns. */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (current === this.source) {
      this.source = replacement as PlanTupleOperator;
    } else {
      this.step = replacement as Calculation;
    }
    this.clearSchema();
    this.addToSchema(this.source.schema);
    this.addToSchema(ctxCols);
  }
  /** Returns `[this.source, this.step]`. */
  getChildren(): PlanOperator[] {
    return [this.source, this.step];
  }
  /** Returns a deep copy with cloned `step` and `source`. */
  clone(): TreeJoin {
    return new TreeJoin(this.lang, this.step.clone(), this.source.clone());
  }
}
