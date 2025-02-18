import { Trie } from 'mnemonist';
import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';

export class TupleSource extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public name: ASTIdentifier | Aliased<ASTIdentifier>,
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<(string | symbol)[]>(Array);
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTupleSource(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    throw new Error('Method not implemented.');
  }
}

export class TupleFnSource extends LogicalPlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public args: (ASTIdentifier | Calculation)[],
    public impl: (...args: any[]) => Iterable<unknown>,
    public name?: ASTIdentifier | Aliased<ASTIdentifier>,
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<(string | symbol)[]>(Array);
    arrSetParent(this.args, this);
  }

  accept<Ret, Arg>(
    visitors: Record<string, LogicalPlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTupleFnSource(this, arg);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator,
  ): void {
    const i = this.args.indexOf(current as Calculation);
    this.args[i] = replacement as Calculation;
  }
}
