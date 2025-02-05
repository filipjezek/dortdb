import { Trie, TrieMap } from 'mnemonist';
import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';
import { schemaToTrie } from '../../../utils/trie.js';

export class Projection extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public attrs: Aliased<ASTIdentifier | Calculation>[],
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = attrs.map((a) => a[1]);
    this.schemaSet = schemaToTrie(this.schema);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjection(this);
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
    public lang: Lowercase<string>,
    /** mapping must be interpreted in the context of the source */
    public mapping: LogicalPlanTupleOperator,
    public outer: boolean,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = source.schema
      .filter((x) => !mapping.schemaSet.has(x.parts))
      .concat(mapping.schema);
    this.schemaSet = schemaToTrie(this.schema);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionConcat(this);
  }
}

export class ProjectionIndex extends LogicalPlanTupleOperator {
  constructor(
    public lang: Lowercase<string>,
    public indexCol: ASTIdentifier,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = [
      ...source.schema.filter((x) => !x.equals(indexCol)),
      indexCol,
    ];
    this.schemaSet = schemaToTrie(this.schema);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionIndex(this);
  }
}
