import {
  ASTLiteral,
  ASTOperator,
  ASTFunction,
  ASTIdentifier,
  LogicalPlanOperator,
  Sort,
  Limit,
  LangSwitch,
  assertLiteral,
  LanguageManager,
} from '@dortdb/core';
import {
  ASTTableAlias,
  ASTFieldSelector,
  ASTExpressionAlias,
  ASTAggregate,
  ASTArray,
  ASTCase,
  ASTCast,
  ASTExists,
  ASTNumberLiteral,
  ASTParam,
  ASTQuantifier,
  ASTRow,
  ASTStringLiteral,
  ASTSubscript,
  ASTWindowFn,
  GroupByClause,
  JoinClause,
  RowsFrom,
  SelectSet,
  SelectSetOp,
  SelectStatement,
  TableFn,
  ValuesClause,
  WindowSpec,
  WithQuery,
} from '../ast/index.js';
import { SQLVisitor } from '../ast/visitor.js';

export class SQLLogicalPlanBuilder implements SQLVisitor<LogicalPlanOperator> {
  constructor(
    private langMgr: LanguageManager,
    private params: Record<string, any>
  ) {}

  visitStringLiteral(node: ASTStringLiteral): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitNumberLiteral(node: ASTNumberLiteral): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitArray(node: ASTArray): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitRow(node: ASTRow): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitParam(node: ASTParam): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCast(node: ASTCast): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSubscript(node: ASTSubscript): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitExists(node: ASTExists): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitQuantifier(node: ASTQuantifier): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitIdentifier(node: ASTIdentifier): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitTableAlias(node: ASTTableAlias): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitFieldSelector(node: ASTFieldSelector): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitExpressionAlias(node: ASTExpressionAlias): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSelectStatement(node: SelectStatement) {
    if (node.withQueries?.length) throw new Error('With queries not supported');
    let op = this.visitSelectSet(node.selectSet);
    if (node.orderBy?.length) {
      op = new Sort(node.orderBy, op);
    }
    if (node.limit || node.offset) {
      if (node.limit && !assertLiteral(node.limit, 'number'))
        throw new Error('Limit must be a number constant');
      if (node.offset && !assertLiteral(node.offset, 'number'))
        throw new Error('Offset must be a number constant');
      new Limit(
        (node.offset as ASTLiteral<number>)?.value ?? 0,
        (node.limit as ASTLiteral<number>)?.value ?? 0,
        op
      );
    }
    return op;
  }
  visitSelectSetOp(node: SelectSetOp): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSelectSet(node: SelectSet): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitGroupByClause(node: GroupByClause): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitJoinClause(node: JoinClause): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCase(node: ASTCase): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitValues(node: ValuesClause): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitAggregate(node: ASTAggregate): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitWindowSpec(node: WindowSpec): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitWindowFn(node: ASTWindowFn): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitTableFn(node: TableFn): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitRowsFrom(node: RowsFrom): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitWithQuery(node: WithQuery): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLiteral<U>(node: ASTLiteral<U>): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitOperator(node: ASTOperator): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitFunction(node: ASTFunction): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLangSwitch(node: LangSwitch): LogicalPlanOperator {
    const lang = this.langMgr.getLang(node.lang);
    return lang.buildLogicalPlan(this.langMgr, this.params, node.node);
  }
}
