import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { AggregateCall } from '../item/aggregate-call.js';
import { Calculation } from '../item/calculation.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { isId, retI0, retI1 } from '../../../internal-fns/index.js';

export class GroupBy extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** in order to calculate schema, we need aliases for calculations */
    public keys: Aliased<ASTIdentifier | Calculation>[],
    public aggs: AggregateCall[],
    public source: LogicalPlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = keys.map(retI1).concat(aggs.map((a) => a.fieldName));
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
    this.dependencies = schemaToTrie(this.keys.map(retI0).filter(isId));
    arrSetParent(keys.map(retI0), this);
    arrSetParent(aggs, this);
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitGroupBy(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    if (current === this.source) {
      this.source = replacement as LogicalPlanTupleOperator;
    } else if (current instanceof AggregateCall) {
      const idx = this.aggs.indexOf(current);
      this.aggs[idx] = replacement as AggregateCall;
    } else {
      this.keys.find((k) => k[0] === current)[0] = replacement as Calculation;
    }
  }
  getChildren(): LogicalPlanOperator[] {
    const res = [this.source] as LogicalPlanOperator[];
    for (const k of this.keys) {
      if (k[0] instanceof Calculation) {
        res.push(k[0]);
      }
    }
    res.push(...this.aggs);
    return res;
  }
}
