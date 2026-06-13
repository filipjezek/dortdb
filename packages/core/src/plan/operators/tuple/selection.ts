import { ASTIdentifier } from '../../../ast.js';
import { idToCalculation } from '../../../utils/calculation.js';
import {
  OpOrId,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
} from '../../visitor.js';
import { Calculation } from '../item/calculation.js';

/** Filters rows from `source` to only those where `condition` evaluates to truthy. */
export class Selection extends PlanTupleOperator {
  /** The filter predicate; a bare identifier is wrapped in a {@link Calculation} automatically. */
  public condition: Calculation;

  constructor(
    lang: Lowercase<string>,
    condition: Calculation | ASTIdentifier,
    /** Tuple operator providing the input rows. */
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

  /** {@inheritDoc PlanOperator.accept} */
  accept<Ret, Arg>(
    visitors: Record<string, PlanVisitor<Ret, Arg>>,
    arg?: Arg,
  ): Ret {
    return visitors[this.lang].visitSelection(this, arg);
  }
  /** {@inheritDoc PlanOperator.replaceChild} */
  replaceChild(current: PlanOperator, replacement: OpOrId): void {
    if (replacement instanceof ASTIdentifier) {
      replacement = idToCalculation(replacement, this.lang);
    }
    replacement.parent = this;
    if (current === this.condition) {
      this.condition = replacement as Calculation;
    } else {
      this.source = replacement as PlanTupleOperator;
    }
  }
  /** {@inheritDoc PlanOperator.getChildren} */
  getChildren(): PlanOperator[] {
    const res: PlanOperator[] = [this.source, this.condition];
    return res;
  }
  /** {@inheritDoc PlanOperator.clone} */
  clone(): Selection {
    return new Selection(
      this.lang,
      this.condition.clone(),
      this.source.clone(),
    );
  }
}
