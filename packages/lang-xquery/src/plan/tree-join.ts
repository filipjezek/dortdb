import {
  ASTIdentifier,
  LogicalPlanTupleOperator,
  operators,
  utils,
} from '@dortdb/core';
import { XQueryLogicalPlanVisitor } from './index.js';
import { DOT, LEN, POS } from '../utils/dot.js';

/**
 * Similar to `ProjectionConcat`, also provides xquery focus context.
 * The `Calculation` output in `step` will be spread into multiple output
 * tuples if it is an array. Removes duplicates of `Node` values.
 */
export class TreeJoin extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public step: operators.Calculation,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = source.schema.slice();
    if (!source.schemaSet.has(DOT.parts)) {
      this.schema.push(DOT, POS, LEN);
    }
    this.schemaSet = utils.schemaToTrie(this.schema);
  }
  accept<T>(visitors: Record<string, XQueryLogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitTreeJoin(this);
  }
}
