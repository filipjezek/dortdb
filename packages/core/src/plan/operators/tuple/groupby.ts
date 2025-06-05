import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  OpOrId,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../../visitor.js';
import { AggregateCall } from '../item/aggregate-call.js';
import { Calculation } from '../item/calculation.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import {
  clone,
  cloneIfPossible,
  isId,
  retI0,
  retI1,
} from '../../../internal-fns/index.js';

export class GroupBy extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** in order to calculate schema, we need aliases for calculations */
    public keys: Aliased<ASTIdentifier | Calculation>[],
    public aggs: AggregateCall[],
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schemaSet = schemaToTrie(
      source.schema.concat(aggs.map((a) => a.fieldName)),
    );
    this.schema = Array.from(this.schemaSet.keys(), (k) =>
      ASTIdentifier.fromParts(k),
    );
    source.parent = this;
    this.dependencies = schemaToTrie(this.keys.map(retI0).filter(isId));
    arrSetParent(keys.map(retI0), this);
    arrSetParent(aggs, this);
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitGroupBy(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: OpOrId): void {
    const isId = replacement instanceof ASTIdentifier;
    if (!isId) {
      replacement.parent = this;
    }
    if (current === this.source) {
      if (isId) throw new Error('Cannot replace source with an identifier');
      this.source = replacement as PlanTupleOperator;
    } else if (current instanceof AggregateCall) {
      if (isId) throw new Error('Cannot replace aggregate with an identifier');
      const idx = this.aggs.indexOf(current);
      this.aggs[idx] = replacement as AggregateCall;
    } else {
      this.keys.find((k) => k[0] === current)[0] = replacement as
        | Calculation
        | ASTIdentifier;
    }
  }
  getChildren(): PlanOperator[] {
    const res = [this.source] as PlanOperator[];
    for (const k of this.keys) {
      if (k[0] instanceof Calculation) {
        res.push(k[0]);
      }
    }
    res.push(...this.aggs);
    return res;
  }

  clone(): GroupBy {
    return new GroupBy(
      this.lang,
      this.keys.map(cloneIfPossible),
      this.aggs.map(clone),
      this.source.clone(),
    );
  }
}
