import { DescentArgs, EqualityChecker, PlanVisitor } from '@dortdb/core';
import {
  LangSwitch,
  SQLPlanVisitor,
  TableAlias,
  Using,
} from '../plan/index.js';

export class SQLEqualityChecker
  extends EqualityChecker
  implements SQLPlanVisitor<boolean, DescentArgs>
{
  constructor(vmap: Record<string, PlanVisitor<boolean, DescentArgs>>) {
    super(vmap);
  }
  visitLangSwitch(a: LangSwitch, args: DescentArgs): boolean {
    const b = args.other as LangSwitch;
    return a.node === b.node;
  }
  visitUsing(a: Using, args: DescentArgs): boolean {
    const b = args.other as Using;
    return (
      a.leftName.equals(b.leftName) &&
      a.rightName.equals(b.rightName) &&
      this.processArray(a.columns, b.columns, args) &&
      this.processItem(a.source, { ...args, other: b.source })
    );
  }
  visitTableAlias(operator: TableAlias, arg?: DescentArgs): boolean {
    const other = arg?.other as TableAlias;
    return (
      operator.alias === other.alias &&
      this.processItem(operator.source, { ...arg, other: other.source })
    );
  }
}
