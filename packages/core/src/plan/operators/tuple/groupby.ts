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

export class GroupBy extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** in order to calculate schema, we need aliases for calculations */
    public keys: Aliased<ASTIdentifier | Calculation>[],
    public aggs: AggregateCall[],
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.lang = lang;
    this.schema = keys.map((k) => k[1]).concat(aggs.map((a) => a.fieldName));
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
    arrSetParent(
      keys.map((k) => k[0]),
      this
    );
    arrSetParent(aggs, this);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitGroupBy(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
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
}
