import { Trie } from '../../../data-structures/trie.js';
import { ASTIdentifier } from '../../../ast.js';
import {
  Aliased,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import { isCalc, isId } from '../../../internal-fns/index.js';
import { schemaToTrie } from '../../../utils/trie.js';

export class TupleSource extends PlanTupleOperator {
  public knownSchema = false;

  constructor(
    lang: Lowercase<string>,
    public name: ASTIdentifier | Aliased<ASTIdentifier>,
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<string | symbol>();
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTupleSource(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    throw new Error('Method not implemented.');
  }
  getChildren(): PlanOperator[] {
    return [];
  }
}

export class TupleFnSource extends PlanTupleOperator {
  public knownSchema = false;

  constructor(
    lang: Lowercase<string>,
    public args: (ASTIdentifier | Calculation)[],
    public impl: (...args: any[]) => Iterable<unknown>,
    public name?: ASTIdentifier | Aliased<ASTIdentifier>,
  ) {
    super();
    this.lang = lang;
    this.schema = [];
    this.schemaSet = new Trie<string | symbol>();
    arrSetParent(this.args, this);
    this.dependencies = schemaToTrie(args.filter(isId));
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitTupleFnSource(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    const i = this.args.indexOf(current as Calculation);
    this.args[i] = replacement as Calculation;
  }
  getChildren(): PlanOperator[] {
    return this.args.filter(isCalc);
  }
}
