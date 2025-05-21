import { ASTIdentifier } from '../../../ast.js';
import { idToCalculation } from '../../../utils/calculation.js';
import { PlanOperator, PlanTupleOperator, PlanVisitor } from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

export class Selection extends PlanTupleOperator {
  public condition: Calculation;

  constructor(
    lang: Lowercase<string>,
    condition: Calculation | ASTIdentifier,
    public source: PlanTupleOperator,
  ) {
    super();
    this.lang = lang;
    this.schema = source.schema;
    this.schemaSet = source.schemaSet;
    this.condition =
      condition instanceof Calculation
        ? condition
        : idToCalculation(condition, lang);
    this.condition.parent = this;
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
    const res: PlanOperator[] = [this.source, this.condition];
    return res;
  }
  clone(): Selection {
    return new Selection(
      this.lang,
      this.condition.clone(),
      this.source.clone(),
    );
  }
}
