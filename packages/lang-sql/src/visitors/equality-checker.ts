import { EcDescentArgs, EqualityChecker, PlanVisitor } from '@dortdb/core';
import {
  LangSwitch,
  SQLPlanVisitor,
  TableAlias,
  Using,
} from '../plan/index.js';

/**
 * Extends the core {@link EqualityChecker} with structural equality checks for
 * SQL-specific plan operators: {@link LangSwitch}, {@link Using}, and {@link TableAlias}.
 */
export class SQLEqualityChecker
  extends EqualityChecker
  implements SQLPlanVisitor<boolean, EcDescentArgs>
{
  constructor(vmap: Record<string, PlanVisitor<boolean, EcDescentArgs>>) {
    super(vmap);
  }
  visitLangSwitch(a: LangSwitch, args: EcDescentArgs): boolean {
    const b = args.other as LangSwitch;
    return a.node === b.node;
  }
  visitUsing(a: Using, args: EcDescentArgs): boolean {
    const b = args.other as Using;
    return (
      a.leftName.equals(b.leftName) &&
      a.rightName.equals(b.rightName) &&
      this.processArray(a.columns, b.columns, args) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitTableAlias(operator: TableAlias, arg?: EcDescentArgs): boolean {
    const other = arg?.other as TableAlias;
    return (
      operator.alias === other.alias &&
      this.processItem(operator.source, { ...arg, other: other.source })
    );
  }
}
