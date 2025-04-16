import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { isCalc, retI0, retI1 } from '../../../internal-fns/index.js';
import { Trie } from '../../../data-structures/trie.js';

export type RenameMap = Trie<string | symbol, (string | symbol)[]>;

export class Projection extends LogicalPlanTupleOperator {
  public renames: RenameMap = new Trie();

  constructor(
    lang: Lowercase<string>,
    public attrs: Aliased<ASTIdentifier | Calculation>[],
    public source: LogicalPlanTupleOperator,
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
        this.dependencies.add(attr.parts);
      }
    }
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjection(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    if (current === this.source) {
      this.source = replacement as LogicalPlanTupleOperator;
    } else {
      this.attrs.find((x) => x[0] === current)[0] = replacement as Calculation;
    }
  }
  getChildren(): LogicalPlanOperator[] {
    const res: LogicalPlanOperator[] = this.attrs.map(retI0).filter(isCalc);
    res.push(this.source);
    return res;
  }
}

/**
 * dependent join, mapping can introduce columns which override the source
 */
export class ProjectionConcat extends LogicalPlanTupleOperator {
  /**
   * empty value for the outer join
   */
  public emptyVal = new Trie<symbol | string, unknown>();

  constructor(
    lang: Lowercase<string>,
    /** mapping must be interpreted in the context of the source */
    public mapping: LogicalPlanTupleOperator,
    public outer: boolean,
    public source: LogicalPlanTupleOperator,
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
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjectionConcat(this, arg);
  }
  replaceChild(
    current: LogicalPlanTupleOperator,
    replacement: LogicalPlanTupleOperator,
  ): void {
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
  getChildren(): LogicalPlanOperator[] {
    return [this.source, this.mapping];
  }
}

export class ProjectionIndex extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public indexCol: ASTIdentifier,
    public source: LogicalPlanTupleOperator,
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
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitProjectionIndex(this, arg);
  }
  replaceChild(
    current: LogicalPlanTupleOperator,
    replacement: LogicalPlanTupleOperator,
  ): void {
    this.source = replacement;
    this.clearSchema();
    this.addToSchema(
      replacement.schema.filter((x) => !x.equals(this.indexCol)),
    );
    this.addToSchema(this.indexCol);
  }
  getChildren(): LogicalPlanOperator[] {
    return [this.source];
  }
}
