import { containsAll, schemaToTrie, union } from '../../../utils/trie.js';
import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Recursion extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public min: number,
    public max: number,
    /** any referenced attributes of the input tuples will be resolved as `[[collected,...], next]` */
    public condition: Calculation,
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    if (condition) {
      condition.parent = this;
    }
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitRecursion(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (current === this.condition) {
      this.condition = replacement as Calculation;
    } else {
      this.source = replacement as PlanTupleOperator;
    }
  }
  getChildren(): PlanOperator[] {
    return [this.source, this.condition];
  }
  clone(): Recursion {
    return new Recursion(
      this.lang,
      this.min,
      this.max,
      this.condition.clone(),
      this.source.clone(),
    );
  }
}

export class IndexedRecursion extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public min: number,
    public max: number,
    public mapping: PlanTupleOperator,
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    mapping.parent = this;
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitIndexedRecursion(this, arg);
  }

  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (current === this.mapping) {
      this.mapping = replacement as PlanTupleOperator;
    } else {
      this.source = replacement as PlanTupleOperator;
    }
  }
  getChildren(): PlanOperator[] {
    return [this.source, this.mapping];
  }
  clone(): IndexedRecursion {
    return new IndexedRecursion(
      this.lang,
      this.min,
      this.max,
      this.mapping.clone(),
      this.source.clone(),
    );
  }
}

export class BidirectionalRecursion extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public min: number,
    public max: number,
    public mappingFwd: PlanTupleOperator,
    public mappingRev: PlanTupleOperator,
    public target: PlanTupleOperator,
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema.concat(
      target.schema.filter((id) => !source.schemaSet.has(id.parts)),
    );
    this.schemaSet = schemaToTrie(this.schema);
    mappingFwd.parent = this;
    mappingRev.parent = this;
    source.parent = this;
    target.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitBidirectionalRecursion(this, arg);
  }

  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (current === this.mappingFwd) {
      this.mappingFwd = replacement as PlanTupleOperator;
    } else if (current === this.mappingRev) {
      this.mappingRev = replacement as PlanTupleOperator;
    } else if (current === this.target) {
      this.target = replacement as PlanTupleOperator;
    } else {
      this.source = replacement as PlanTupleOperator;
    }
  }
  getChildren(): PlanOperator[] {
    return [this.source, this.target, this.mappingFwd, this.mappingRev];
  }
  clone(): BidirectionalRecursion {
    return new BidirectionalRecursion(
      this.lang,
      this.min,
      this.max,
      this.mappingFwd.clone(),
      this.mappingRev.clone(),
      this.target.clone(),
      this.source.clone(),
    );
  }
}
