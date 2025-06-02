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
    public step: Calculation,
    public source: PlanTupleOperator,
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
  accept<Ret, Arg>(
    visitors: Record<string, XQueryPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTreeJoin(this, arg);
  }
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
  getChildren(): PlanOperator[] {
    return [this.source, this.step];
  }
  clone(): TreeJoin {
    return new TreeJoin(this.lang, this.step.clone(), this.source.clone());
  }
}
