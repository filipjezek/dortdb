import { ASTIdentifier } from '../../../ast.js';
import { arrSetParent } from '../../../utils/arr-set-parent.js';
import {
  Aliased,
  LogicalPlanOperator,
  LogicalPlanVisitor,
} from '../../visitor.js';
import { Calculation } from './calculation.js';

export class ItemSource implements LogicalPlanOperator {
  public parent: LogicalPlanOperator;
  constructor(
    public lang: Lowercase<string>,
    public name: ASTIdentifier | Aliased<ASTIdentifier>
  ) {}

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitItemSource(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
  ): void {
    throw new Error('Method not implemented.');
  }
}

export class ItemFnSource implements LogicalPlanOperator {
  public parent: LogicalPlanOperator;
  constructor(
    public lang: Lowercase<string>,
    public args: (ASTIdentifier | Calculation)[],
    public impl: (...args: any[]) => Iterable<any>
  ) {
    arrSetParent(this.args, this);
  }

  accept<T>(visitors: Record<string, LogicalPlanVisitor<T>>): T {
    return visitors[this.lang].visitItemFnSource(this);
  }
  replaceChild(
    current: LogicalPlanOperator,
    replacement: LogicalPlanOperator
  ): void {
    const i = this.args.indexOf(current as Calculation);
    this.args[i] = replacement as Calculation;
  }
}
