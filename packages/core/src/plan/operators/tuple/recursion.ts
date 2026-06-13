import { ASTIdentifier } from '../../../ast.js';
import { cloneIfPossible, isCalc } from '../../../internal-fns/index.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

/**
 * Repeatedly applies a traversal step to a starting set of rows until `condition` becomes
 * false or the hop count reaches `max`, emitting rows at each depth in `[min, max]`.
 */
export class Recursion extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** Minimum number of hops to traverse (inclusive). */
    public min: number,
    /** Maximum number of hops to traverse (inclusive). */
    public max: number,
    /** any referenced attributes of the input tuples will be resolved as `[[collected,...], next]` */
    public condition: Calculation,
    /** Tuple operator providing the start rows. */
    public source: PlanTupleOperator,
    /** If set, the recursion will only consider distinct combinations of these keys */
    public distinctKeys: (Calculation | ASTIdentifier)[] = [],
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    if (condition) {
      condition.parent = this;
    }
    source.parent = this;
    arrSetParent(this.distinctKeys, this);
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitRecursion(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    for (let i = 0; i < this.distinctKeys.length; i++) {
      if (this.distinctKeys[i] === current) {
        this.distinctKeys[i] = replacement as Calculation;
        return;
      }
    }
    if (current === this.condition) {
      this.condition = replacement as Calculation;
    } else {
      this.source = replacement as PlanTupleOperator;
    }
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.source, this.condition, ...this.distinctKeys.filter(isCalc)];
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): Recursion {
    return new Recursion(
      this.lang,
      this.min,
      this.max,
      this.condition.clone(),
      this.source.clone(),
      this.distinctKeys.map(cloneIfPossible),
    );
  }
}

/**
 * Recursion variant that uses an index-backed `mapping` to navigate edges,
 * enabling efficient graph traversals without a full scan per step.
 */
export class IndexedRecursion extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** Minimum number of hops (inclusive). */
    public min: number,
    /** Maximum number of hops (inclusive). */
    public max: number,
    /** Index-backed edge traversal operator evaluated per step. */
    public mapping: PlanTupleOperator,
    /** Tuple operator providing the start rows. */
    public source: PlanTupleOperator,
    /** If set, the recursion will only consider distinct combinations of these keys */
    public distinctKeys: (Calculation | ASTIdentifier)[] = [],
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    mapping.parent = this;
    source.parent = this;
    arrSetParent(this.distinctKeys, this);
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitIndexedRecursion(this, arg);
  }

  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    for (let i = 0; i < this.distinctKeys.length; i++) {
      if (this.distinctKeys[i] === current) {
        this.distinctKeys[i] = replacement as Calculation;
        return;
      }
    }
    if (current === this.mapping) {
      this.mapping = replacement as PlanTupleOperator;
    } else {
      this.source = replacement as PlanTupleOperator;
    }
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.source, this.mapping, ...this.distinctKeys.filter(isCalc)];
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): IndexedRecursion {
    return new IndexedRecursion(
      this.lang,
      this.min,
      this.max,
      this.mapping.clone(),
      this.source.clone(),
      this.distinctKeys.map(cloneIfPossible),
    );
  }
}

/**
 * Bidirectional graph traversal that expands from `source` forward via `mappingFwd`
 * and from `target` backward via `mappingRev`, meeting in the middle.
 *
 * The output schema merges the schemas of `source` and `target`.
 */
export class BidirectionalRecursion extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** Minimum path length (inclusive). */
    public min: number,
    /** Maximum path length (inclusive). */
    public max: number,
    /** Forward edge-traversal operator (from source toward target). */
    public mappingFwd: PlanTupleOperator,
    /** Reverse edge-traversal operator (from target toward source). */
    public mappingRev: PlanTupleOperator,
    /** Tuple operator providing the target rows. */
    public target: PlanTupleOperator,
    /** Tuple operator providing the source (start) rows. */
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

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitBidirectionalRecursion(this, arg);
  }

  /** {@inheritDoc PlanOperator.replaceChild} */
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
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.source, this.target, this.mappingFwd, this.mappingRev];
  }
  /** {@inheritDoc PlanOperator.clone} */
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
