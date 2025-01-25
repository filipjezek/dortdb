import { Trie } from 'mnemonist';
import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class TupleSource extends LogicalPlanTupleOperator {
  constructor(
    public lang: string,
    public name: ASTIdentifier | Aliased<ASTIdentifier>
  ) {
    super();
    this.schema = [];
    this.schemaSet = new Trie<(string | symbol)[]>(Array);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitTupleSource(this);
  }
}

export class TupleFnSource extends LogicalPlanTupleOperator {
  constructor(
    public lang: string,
    public args: (ASTIdentifier | Calculation)[],
    public impl: (...args: any[]) => Iterable<any>
  ) {
    super();
    this.schema = [];
    this.schemaSet = new Trie<(string | symbol)[]>(Array);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitTupleFnSource(this);
  }
}
