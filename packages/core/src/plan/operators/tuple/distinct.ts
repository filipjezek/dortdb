import { allAttrs, ASTIdentifier } from '../../../ast.js';
import { cloneIfPossible, isCalc, isId } from '../../../internal-fns/index.js';
import { schemaToTrie } from '../../../utils/trie.js';
import {
  OpOrId,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Distinct extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public attrs: (ASTIdentifier | Calculation)[] | typeof allAttrs,
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    source.parent = this;
    if (attrs === allAttrs) {
      this.dependencies.add([allAttrs]);
    } else {
      this.dependencies = schemaToTrie(attrs.filter(isId));
    }
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitDistinct(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: OpOrId): void {
    const isId = replacement instanceof ASTIdentifier;
    if (!isId) {
      replacement.parent = this;
    }
    if (this.source === current) {
      if (isId) throw new Error('Cannot replace source with an identifier');
      this.source = replacement as PlanTupleOperator;
    } else {
      const index = (this.attrs as (Calculation | ASTIdentifier)[]).indexOf(
        current as Calculation | ASTIdentifier,
      );
      (this.attrs as (Calculation | ASTIdentifier)[])[index] = replacement as
        | Calculation
        | ASTIdentifier;
    }
  }
  getChildren(): PlanOperator[] {
    const res: PlanOperator[] = [this.source];
    if (this.attrs !== allAttrs) {
      res.push(...this.attrs.filter(isCalc));
    }
    return res;
  }
  clone(): Distinct {
    return new Distinct(
      this.lang,
      this.attrs === allAttrs ? this.attrs : this.attrs.map(cloneIfPossible),
      this.source.clone(),
    );
  }
}
