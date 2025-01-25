import { Trie } from 'mnemonist';
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
    public lang: string,
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
 * dependent join
 */
export class ProjectionConcat extends LogicalPlanTupleOperator {
  constructor(
    public lang: string,
    /** mapping must be interpreted in the context of the source */
    public mapping: LogicalPlanTupleOperator,
    public outer: boolean,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = source.schema.concat(mapping.schema);
    this.schemaSet = schemaToTrie(this.schema);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionConcat(this);
  }
}

export class ProjectionIndex extends LogicalPlanTupleOperator {
  constructor(
    public lang: string,
    public indexCol: ASTIdentifier,
    public source: LogicalPlanTupleOperator
  ) {
    super();
    this.schema = [...source.schema, indexCol];
    this.schemaSet = schemaToTrie(this.schema);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitProjectionIndex(this);
  }
}
