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
import { cloneIfPossible, isCalc, isId } from '../../../internal-fns/index.js';
import { schemaToTrie } from '../../../utils/trie.js';
import { Index } from '../../../indices/index.js';

export class TupleSource extends PlanTupleOperator {
  /**
   * @param name This should be aliased only while building the plan. It should be replaced with Projection before the actual execution.
   */
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
  clone(): TupleSource {
    const res = new TupleSource(this.lang, this.name);
    res.schema = this.schema.slice();
    res.schemaSet = this.schemaSet.clone();
    return res;
  }
}

export class TupleFnSource extends PlanTupleOperator {
  /**
   * @param name This should be aliased only while building the plan. It should be replaced with Projection before the actual execution.
   */
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
  clone(): TupleFnSource {
    const res = new TupleFnSource(
      this.lang,
      this.args.map(cloneIfPossible),
      this.impl,
      this.name,
    );
    res.schema = this.schema.slice();
    res.schemaSet = this.schemaSet.clone();
    return res;
  }
}

export class IndexScan extends TupleSource {
  constructor(
    lang: Lowercase<string>,
    name: ASTIdentifier,
    public index: Index,
    public access: Calculation,
    public fromItemKey?: ASTIdentifier,
  ) {
    super(lang, name);
    this.access.parent = this;
  }

  override accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitIndexScan(this, arg);
  }

  override replaceChild(
    current: PlanOperator,
    replacement: PlanOperator,
  ): void {
    replacement.parent = this;
    this.access = replacement as Calculation;
  }

  override getChildren(): PlanOperator[] {
    return [this.access];
  }
  override clone(): IndexScan {
    const res = new IndexScan(
      this.lang,
      this.name as ASTIdentifier,
      this.index,
      this.access.clone(),
      this.fromItemKey,
    );
    res.schema = this.schema.slice();
    res.schemaSet = this.schemaSet.clone();
    return res;
  }
}
