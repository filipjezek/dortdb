import { ASTIdentifier } from '../../../ast.js';
import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Selection extends PlanTupleOperator {
  constructor(
    lang: Lowercase<string>,
    public condition: Calculation | ASTIdentifier,
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    if (condition instanceof Calculation) condition.parent = this;
    else this.dependencies.add(condition.parts);
    source.parent = this;
  }

  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitSelection(this, arg);
  }
  replaceChild(current: PlanOperator, replacement: PlanOperator): void {
    replacement.parent = this;
    if (current === this.condition) {
      this.condition = replacement as Calculation;
    } else {
      this.source = replacement as PlanTupleOperator;
    }
  }
  getChildren(): PlanOperator[] {
    const res: PlanOperator[] = [this.source];
    if (this.condition instanceof Calculation) {
      res.push(this.condition);
    }
    return res;
  }
}
