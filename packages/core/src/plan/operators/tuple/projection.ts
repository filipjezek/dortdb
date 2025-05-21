import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
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

export type RenameMap = Trie<
  string | symbol | number,
  (string | symbol | number)[]
>;

export class Projection extends PlanTupleOperator {
  public renames: RenameMap = new Trie();
  public renamesInv: RenameMap = new Trie();

  constructor(
    lang: Lowercase<string>,
    public attrs: Aliased<ASTIdentifier | Calculation>[],
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = attrs.map(retI1);
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
    arrSetParent(this.attrs.map(retI0), this);
    for (const [attr, alias] of this.attrs) {
      if (attr instanceof ASTIdentifier) {
        this.renames.set(attr.parts, alias.parts);
        this.renamesInv.set(alias.parts, attr.parts);
        this.dependencies.add(attr.parts);
      }
    }
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjection(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (current === this.source) {
      this.source = replacement as PlanTupleOperator;
    } else {
      this.attrs.find((x) => x[0] === current)[0] = replacement as Calculation;
    }
  }
  getChildren(): PlanOperator[] {
    const res: PlanOperator[] = this.attrs.map(retI0).filter(isCalc);
    res.push(this.source);
    return res;
  }

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
    public outer: boolean,
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

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjectionConcat(this, arg);
  }
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
  getChildren(): PlanOperator[] {
    return [this.source, this.mapping];
  }
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

export class ProjectionIndex extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public indexCol: ASTIdentifier,
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

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjectionIndex(this, arg);
  }
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
  getChildren(): PlanOperator[] {
    return [this.source];
  }
  clone(): ProjectionIndex {
    return new ProjectionIndex(this.lang, this.indexCol, this.source.clone());
  }
}
