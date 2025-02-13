import {
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  operators,
  utils,
} from '@dortdb/core';
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
    public lang: Lowercase<string>,
    public step: operators.Calculation,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    source.parent = this;
    step.parent = this;
    this.schema = source.schema.slice();

    for (const col of ctxCols) {
      if (!source.schemaSet.has(col.parts)) this.schema.push(col);
    }
    this.schemaSet = utils.schemaToTrie(this.schema);
  }
  accept<T>(visitors: Record<string, XQueryLogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitTreeJoin(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
  ): void {
    if (current === this.source) {
      this.source = replacement as LogicalPlanTupleOperator;
    } else {
      this.step = replacement as operators.Calculation;
    }
    this.clearSchema();
    this.addToSchema(this.source.schema);
    this.addToSchema(ctxCols);
  }
}
