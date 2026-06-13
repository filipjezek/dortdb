import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  OpOrId,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import {
  cloneIfPossible,
  isCalc,
  retI0,
  retI1,
} from '../../../internal-fns/index.js';
import { Trie } from '../../../data-structures/trie.js';

/** Maps a multi-part identifier path to the renamed path; used in {@link Projection}. */
export type RenameMap = Trie<
  string | symbol | number,
  (string | symbol | number)[]
>;

/**
 * Projects a subset of attributes from its source, optionally renaming them.
 *
 * `renames` maps original paths to alias paths; `renamesInv` is the inverse.
 */
export class Projection extends PlanTupleOperator {
  /** Forward rename map: original attribute path → alias path. */
  public renames: RenameMap = new Trie();
  /** Inverse rename map: alias path → original attribute path. */
  public renamesInv: RenameMap = new Trie();

  constructor(
    lang: Lowercase<string>,
    /** Attributes to emit, each paired with its output alias. */
    public attrs: Aliased<ASTIdentifier | Calculation>[],
    /** Tuple operator providing the input rows. */
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = attrs.map(retI1);
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
    for (const [attr, alias] of this.attrs) {
      if (attr instanceof ASTIdentifier) {
        this.renames.set(attr.parts, alias.parts);
        this.renamesInv.set(alias.parts, attr.parts);
        this.dependencies.add(attr.parts);
      } else {
        attr.parent = this;
      }
    }
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjection(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: OpOrId): void {
    const isId = replacement instanceof ASTIdentifier;
    if (!isId) {
      replacement.parent = this;
    }
    if (current === this.source) {
      if (isId) {
        throw new Error('cannot replace source with identifier');
      }
      this.source = replacement as PlanTupleOperator;
    } else {
      this.attrs.find((x) => x[0] === current)[0] = replacement as
        | Calculation
        | ASTIdentifier;
    }
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    const res: PlanOperator[] = this.attrs.map(retI0).filter(isCalc);
    res.push(this.source);
    return res;
  }

  /** {@inheritDoc PlanOperator.clone} */
  clone(): Projection {
    return new Projection(
      this.lang,
      this.attrs.map(cloneIfPossible),
      this.source.clone(),
    );
  }
}

/**
 * dependent join, mapping can introduce columns which override the source
 */
export class ProjectionConcat extends PlanTupleOperator {
  /**
   * empty value for the outer join (default is null)
   */
  public emptyVal = new Trie<symbol | string | number, unknown>();
  /**
   * if true, the `mapping` is not allowed to return multiple values per one `source` value
   */
  public validateSingleValue = false;

  constructor(
    lang: Lowercase<string>,
    /** mapping must be interpreted in the context of the source */
    public mapping: PlanTupleOperator,
    /** When `true`, rows from `source` with no matching `mapping` rows are still emitted (outer join). */
    public outer: boolean,
    /** Tuple operator providing the driving rows. */
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema
      .filter((x) => !mapping.schemaSet.has(x.parts))
      .concat(mapping.schema);
    this.schemaSet = schemaToTrie(this.schema);
    mapping.parent = this;
    source.parent = this;
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjectionConcat(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    if (current === this.mapping) {
      this.mapping = replacement;
    } else {
      this.source = replacement;
    }
    this.clearSchema();
    this.addToSchema(this.source.schema);
    this.removeFromSchema(this.mapping.schema);
    this.addToSchema(this.mapping.schema);
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.source, this.mapping];
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): ProjectionConcat {
    const res = new ProjectionConcat(
      this.lang,
      this.mapping.clone(),
      this.outer,
      this.source.clone(),
    );
    res.emptyVal = this.emptyVal.clone();
    res.validateSingleValue = this.validateSingleValue;
    return res;
  }
}

/**
 * Appends or moves a positional index column to the end of the schema,
 * enabling index-based access to rows in the stream.
 */
export class ProjectionIndex extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    /** The attribute identifier used as the row-index column. */
    public indexCol: ASTIdentifier,
    /** Tuple operator providing the input rows. */
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = [
      ...source.schema.filter((x) => !x.equals(indexCol)),
      indexCol,
    ];
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
  }

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjectionIndex(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(
    current: PlanTupleOperator,
    replacement: PlanTupleOperator,
  ): void {
    replacement.parent = this;
    this.source = replacement;
    this.clearSchema();
    this.addToSchema(
      replacement.schema.filter((x) => !x.equals(this.indexCol)),
    );
    this.addToSchema(this.indexCol);
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    return [this.source];
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): ProjectionIndex {
    return new ProjectionIndex(this.lang, this.indexCol, this.source.clone());
  }
}
