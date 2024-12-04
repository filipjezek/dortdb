import {
  ASTFunction,
  ASTIdentifier,
  ASTLiteral,
  ASTNode,
  ASTOperator,
  LangSwitch,
  LanguageManager,
} from '@dortdb/core';
import { SQLVisitor } from '../ast/visitor.js';
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
} from '../ast/index.js';
import { WindowSpec } from '../ast/window.js';
import { WithQuery } from '../ast/with.js';

export class SQLExprSimplifier implements SQLVisitor<ASTNode> {
  constructor(
    private langMgr: LanguageManager,
    private params: Record<string, any>
  ) {}

  visitStringLiteral(node: ASTStringLiteral): ASTNode {
    return node;
  }
  visitNumberLiteral(node: ASTNumberLiteral): ASTNode {
    return node;
  }
  visitArray(node: ASTArray): ASTNode {
    if (node.items instanceof Array) {
      node.items = node.items.map((item) => item.accept(this));
    }
    return node; // cannot return literal as it would be the same reference for each row
  }
  visitRow(node: ASTRow): ASTNode {
    if (node.items.length === 0) return new ASTLiteral(null, {});
    node.items = node.items.map((item) => item.accept(this));
    return node; // cannot return literal as it would be the same reference for each row
  }
  visitParam(node: ASTParam): ASTNode {
    if (!(node.name in this.params)) return node;
    return new ASTLiteral(null, this.params[node.name] ?? null);
  }
  visitCast(node: ASTCast): ASTNode {
    node.expr = node.expr.accept(this);
    if (node.expr instanceof ASTLiteral) {
      const castable = this.langMgr.getCast(
        'sql',
        node.type.id,
        node.type.schema
      );
      if (castable) {
        if (node.isArray)
          return new ASTLiteral(
            null,
            (JSON.parse(node.expr.value) as any[]).map((x) =>
              castable.convert(x)
            )
          );
        return new ASTLiteral(null, castable.convert(node.expr.value));
      }
      throw new Error(`Unknown cast: ${node.type}`);
    }
    return node;
  }
  visitSubscript(node: ASTSubscript): ASTNode {
    node.expr = node.expr.accept(this);
    node.from = node.from.accept(this);
    node.to = node.to?.accept(this);
    if (
      node.expr instanceof ASTLiteral &&
      node.from instanceof ASTLiteral &&
      (!node.to || node.to instanceof ASTLiteral)
    ) {
      const arr = node.expr.value;
      const from = node.from.value;
      const to = (node.to as ASTLiteral<number>)?.value;
      if (arr instanceof Array) {
        return new ASTLiteral(
          null,
          to === undefined || to === null
            ? arr[from]
            : arr.slice(from, to !== undefined ? to : arr.length)
        );
      }
      throw new Error(`Subscript on non-array: ${arr}[${from}:${to}]`);
    }
    return node;
  }
  visitExists(node: ASTExists): ASTNode {
    node.query = node.query.accept(this);
    return node;
  }
  visitQuantifier(node: ASTQuantifier): ASTNode {
    node.query = node.query.accept(this);
    return node;
  }
  visitIdentifier(node: ASTIdentifier): ASTNode {
    return node;
  }
  visitTableAlias(node: ASTTableAlias): ASTNode {
    return node;
  }
  visitFieldSelector(node: ASTFieldSelector): ASTNode {
    return node;
  }
  visitExpressionAlias(node: ASTExpressionAlias): ASTNode {
    node.expression = node.expression.accept(this);
    return node;
  }
  visitSelectStatement(node: SelectStatement): ASTNode {
    node.limit = node.limit?.accept(this);
    node.offset = node.offset?.accept(this);
    node.selectSet = node.selectSet.accept(this) as SelectSet;
    node.orderBy = node.orderBy?.map((item) => ({
      ...item,
      expression: item.expression.accept(this),
    }));
    node.withQueries = node.withQueries?.map(
      (item) => item.accept(this) as WithQuery
    );
    return node;
  }
  visitSelectSetOp(node: SelectSetOp): ASTNode {
    node.next = node.next.accept(this) as SelectStatement;
    return node;
  }
  visitSelectSet(node: SelectSet): ASTNode {
    node.items = node.items.map((item) => item.accept(this));
    node.from = node.from?.accept(this);
    node.where = node.where?.accept(this);
    node.groupBy = node.groupBy?.accept(this) as GroupByClause;
    node.having = node.having?.accept(this);
    node.distinct =
      node.distinct instanceof Array
        ? node.distinct.map((item) => item.accept(this))
        : node.distinct;
    node.windows = node.windows?.map((item) => item.accept(this));
    node.setOp = node.setOp?.accept(this) as SelectSetOp;
    return node;
  }
  visitGroupByClause(node: GroupByClause): ASTNode {
    node.items =
      node.items[0] instanceof Array
        ? node.items.map((item) =>
            (item as ASTNode[]).map((i) => i.accept(this))
          )
        : node.items.map((item) => (item as ASTNode).accept(this));
    return node;
  }
  visitJoinClause(node: JoinClause): ASTNode {
    node.condition = node.condition.accept(this);
    node.table = node.table.accept(this);
    node.using =
      node.using instanceof Array
        ? node.using.map((item) => item.accept(this))
        : (node.using.accept(this) as ASTTableAlias);
    return node;
  }
  visitCase(node: ASTCase): ASTNode {
    node.expr = node.expr?.accept(this);
    node.elseExpr = node.elseExpr?.accept(this);
    node.whenThen = node.whenThen.map(([w, t]) => [
      w.accept(this),
      t.accept(this),
    ]);
    if (node.expr instanceof ASTLiteral) {
      let possibleDynamic = false;
      for (const [w, t] of node.whenThen) {
        if (w instanceof ASTLiteral) {
          if (w.value === node.expr.value) return t;
        } else {
          possibleDynamic = true;
        }
      }
      return possibleDynamic
        ? node
        : node.elseExpr ?? new ASTLiteral(null, null);
    } else if (!node.expr) {
      for (const [w, t] of node.whenThen) {
        if (w instanceof ASTLiteral && w.value) return t;
      }
    }
    return node;
  }
  visitValues(node: ValuesClause): ASTNode {
    node.values = node.values.map((row) =>
      row.map((item) => item.accept(this))
    );
    return node;
  }
  visitAggregate(node: ASTAggregate): ASTNode {
    node.args = node.args.map((arg) => arg.accept(this));
    node.filter = node.filter?.accept(this);
    node.orderBy = node.orderBy?.map((item) => ({
      ...item,
      expression: item.expression.accept(this),
    }));
    node.withinGroupArgs = node.withinGroupArgs?.map((arg) => arg.accept(this));
    return node;
  }
  visitWindowSpec(node: WindowSpec): ASTNode {
    node.columns = node.columns.map((col) => col.accept(this));
    node.end = node.end?.accept(this);
    node.start = node.start?.accept(this);
    return node;
  }
  visitWindowFn(node: ASTWindowFn): ASTNode {
    node = this.visitAggregate(node) as ASTWindowFn;
    node.window = node.window.accept(this) as WindowSpec | ASTIdentifier;
    return node;
  }
  visitTableFn(node: TableFn): ASTNode {
    node.args = node.args.map((arg) => arg.accept(this));
    return node;
  }
  visitRowsFrom(node: RowsFrom): ASTNode {
    node.tableFns = node.tableFns.map((fn) => fn.accept(this) as TableFn);
    return node;
  }
  visitWithQuery(node: WithQuery): ASTNode {
    node.cycleMarkDefault = node.cycleMarkDefault?.accept(this);
    node.cycleMarkVal = node.cycleMarkVal?.accept(this);
    node.query = node.query.accept(this);
    return node;
  }
  visitLiteral<U>(node: ASTLiteral<U>): ASTNode {
    return node;
  }
  visitOperator(node: ASTOperator): ASTNode {
    node.operands = node.operands.map((op) => op.accept(this));
    if (node.operands.every((op) => op instanceof ASTLiteral)) {
      const op = this.langMgr.getOp('sql', node.id.id, node.id.schema);
      if (!op)
        throw new Error(`Unknown operator: ${node.id.schema}.${node.id.id}`);
      const res = op.impl(
        node.operands.map((op) => (op as ASTLiteral<any>).value)
      );
      if (res && typeof res === 'object') return node; // cannot return literal as it would be the same reference for each row
      return new ASTLiteral(null, res ?? null);
    }
    return node;
  }
  visitFunction(node: ASTFunction): ASTNode {
    node.args = node.args.map((arg) => arg.accept(this));
    if (node.args.every((arg) => arg instanceof ASTLiteral)) {
      const fn = this.langMgr.getFn('sql', node.id.id, node.id.schema);
      if (!fn)
        throw new Error(`Unknown function: ${node.id.schema}.${node.id.id}`);
      const res = fn.impl(
        node.args.map((arg) => (arg as ASTLiteral<any>).value)
      );
      if (res && typeof res === 'object') return node; // cannot return literal as it would be the same reference for each row
      return new ASTLiteral(null, res ?? null);
    }
    return node;
  }
  visitLangSwitch(node: LangSwitch): ASTNode {
    return node;
  }
}
