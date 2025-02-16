import { LogicalPlanOperator, LogicalPlanTupleOperator } from '@dortdb/core';
import { schemaToTrie } from '@dortdb/core/utils';
import { Calculation } from '@dortdb/core/plan';
import { XQueryLogicalPlanVisitor } from './index.js';
import { DOT, LEN, POS } from '../utils/dot.js';

const ctxCols = [DOT, POS, LEN];

/**
 * Similar to {@link operators.ProjectionConcat}, also provides xquery focus context.
 * The {@link operators.Calculation} output in `step` will be spread into multiple output
 * tuples if it is an array. Removes duplicates of `Node` values.
 */
export class TreeJoin extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public step: Calculation,
    public source: LogicalPlanTupleOperator,
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
  accept<Ret, Arg>(
    visitors: Record<string, XQueryLogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTreeJoin(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    if (current === this.source) {
      this.source = replacement as LogicalPlanTupleOperator;
    } else {
      this.step = replacement as Calculation;
    }
    this.clearSchema();
    this.addToSchema(this.source.schema);
    this.addToSchema(ctxCols);
  }
}
