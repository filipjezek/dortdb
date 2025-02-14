import { Trie, TrieMap } from 'mnemonist';
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

export class Projection extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public attrs: Aliased<ASTIdentifier | Calculation>[],
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.lang = lang;
    this.schema = attrs.map((a) => a[1]);
    this.schemaSet = schemaToTrie(this.schema);
    source.parent = this;
    arrSetParent(
      this.attrs.map((x) => x[0]),
      this
    );
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjection(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
  ): void {
    if (current === this.source) {
      this.source = replacement as LogicalPlanTupleOperator;
    } else {
      this.attrs.find((x) => x[0] === current)[0] = replacement as Calculation;
    }
  }
}

/**
 * dependent join, mapping can introduce columns which override the source
 */
export class ProjectionConcat extends LogicalPlanTupleOperator {
  /**
   * empty value for the outer join
   */
  public emptyVal = new TrieMap<(symbol | string)[], any>(Array);

  constructor(
    lang: Lowercase<string>,
    /** mapping must be interpreted in the context of the source */
    public mapping: LogicalPlanTupleOperator,
    public outer: boolean,
    public source: LogicalPlanTupleOperator
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

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionConcat(this);
  }
  replaceChild(
    current: LogicalPlanTupleOperator,
    replacement: LogicalPlanTupleOperator
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
}

export class ProjectionIndex extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public indexCol: ASTIdentifier,
    public source: LogicalPlanTupleOperator
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

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionIndex(this);
  }
  replaceChild(
    current: LogicalPlanTupleOperator,
    replacement: LogicalPlanTupleOperator
  ): void {
    this.source = replacement;
    this.clearSchema();
    this.addToSchema(
      replacement.schema.filter((x) => !x.equals(this.indexCol))
    );
    this.addToSchema(this.indexCol);
  }
}
