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
  Union,
  Intersection,
  Difference,
  Distinct,
  Projection,
  Aliased,
  ASTNode,
  Source,
  CartesianProduct,
  Selection,
  Calculation,
  UnsupportedError,
  allAttrs,
  groupbyAttr,
} from '@dortdb/core';
import {
  ASTTableAlias,
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
  SelectSetOpType,
  ASTIdentifier as ASTIdentifierClass,
  GroupByType,
} from '../ast/index.js';
import { SQLVisitor } from '../ast/visitor.js';
import { ASTDeterministicStringifier } from './ast-stringifier.js';

export class SQLLogicalPlanBuilder implements SQLVisitor<LogicalPlanOperator> {
  private stringifier = new ASTDeterministicStringifier();

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
  visitExpressionAlias(node: ASTExpressionAlias): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }

  visitSelectStatement(node: SelectStatement) {
    if (node.withQueries?.length)
      throw new UnsupportedError('With queries not supported');
    let op = this.visitSelectSet(node.selectSet);
    if (node.orderBy?.length) {
      const proj = this.findProjection(op); // always defined, because grammar does not allow orderby without select attributes
      const origProjFields = proj?.fields;
      const orderFields = node.orderBy.map((x) =>
        this.processAttr(x.expression)
      );
      proj.fields = origProjFields.concat(orderFields);
      op = new Sort(
        node.orderBy.map((x, i) => ({
          ...x,
          expression:
            orderFields[i] instanceof Array
              ? (orderFields[i][1] as ASTIdentifier)
              : orderFields[i],
        })),
        op
      );
      op = new Projection(origProjFields, op);
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

  visitSelectSetOp(
    node: SelectSetOp,
    left: LogicalPlanOperator = null
  ): LogicalPlanOperator {
    let next = node.next.accept(this);
    switch (node.type) {
      case SelectSetOpType.UNION:
        next = new Union(left, next);
        return node.distinct ? new Distinct(null, next) : next;
      case SelectSetOpType.INTERSECT:
        return new Intersection(left, next);
      case SelectSetOpType.EXCEPT:
        return new Difference(left, next);
    }
  }

  visitSelectSet(node: SelectSet): LogicalPlanOperator {
    let op: LogicalPlanOperator = null;
    if (node.from) {
      op = node.from.accept(this);
    }
    if (node.windows) {
      throw new UnsupportedError('Window functions not supported');
    }
    if (node.distinct) {
      op = new Distinct(
        node.distinct === true
          ? null
          : node.distinct.map((x) => this.processAttr(x)),
        op
      );
    }
    if (node.setOp) {
      op = this.visitSelectSetOp(node.setOp, op);
    }
    if (node.items) {
      op = new Projection(
        node.items.map((x) => this.processAttr(x)),
        op
      );
    }
    if (node.where) {
      op = new Selection(node.where.accept(this) as Calculation, op);
    }
    if (node.having) {
      op = new Selection(node.where.accept(this) as Calculation, op);
    }
    if (node.groupBy) {
      op = this.visitGroupByClause(node.groupBy, op);
    }
    return op;
  }

  private processAttr(
    attr: ASTNode
  ): ASTIdentifier | Aliased<ASTIdentifier> | Aliased<LogicalPlanOperator> {
    if (attr instanceof ASTIdentifierClass) {
      return attr as ASTIdentifier;
    }
    if (attr instanceof ASTExpressionAlias) {
      const alias = new ASTIdentifierClass('');
      alias.id = attr.alias;
      if (attr.expression instanceof ASTIdentifierClass) {
        return [attr.expression, alias];
      }
      return [attr.expression.accept(this), alias];
    }
    const alias = new ASTIdentifierClass('');
    alias.id = attr.accept(this.stringifier);
    return [attr.accept(this), alias];
  }

  private findProjection(node: LogicalPlanOperator): Projection {
    if (node instanceof Projection) return node;
    if ('source' in node)
      return this.findProjection(node.source as LogicalPlanOperator);
    if (
      node instanceof Union ||
      node instanceof Intersection ||
      node instanceof Difference
    ) {
      return this.findProjection(node.left);
    }
    return null;
  }

  visitGroupByClause(
    node: GroupByClause,
    src: LogicalPlanOperator = null
  ): LogicalPlanOperator {
    if (node.type !== GroupByType.BASIC)
      throw new UnsupportedError(`Group by type "${node.type}" not supported`);
    const attrs = (node.items as ASTNode[]).map((x) => this.processAttr(x));
    attrs.push([
      new Projection([new ASTIdentifierClass(allAttrs)], src),
      groupbyAttr,
    ]);
    return new Projection(
      (node.items as ASTNode[]).map((x) => this.processAttr(x)),
      src
    );
  }
  visitJoinClause(node: JoinClause): LogicalPlanOperator {
    if (node.natural) throw new UnsupportedError('Natural joins not supported');
    if (node.lateral) throw new UnsupportedError('Lateral joins not supported');
    const left = node.tableLeft.accept(this);
    const right = node.tableRight.accept(this);
    let op: LogicalPlanOperator = new CartesianProduct([]);
    if (left instanceof CartesianProduct) {
      (op as CartesianProduct).sources.push(...left.sources);
    } else {
      (op as CartesianProduct).sources.push(left);
    }
    if (right instanceof CartesianProduct) {
      (op as CartesianProduct).sources.push(...right.sources);
    } else {
      (op as CartesianProduct).sources.push(right);
    }

    if (node.condition) {
      op = new Selection(node.condition.accept(this) as Calculation, op);
    }
    if (node.using) {
      // TODO: remove duplicate columns
      op = new Selection();
    }
    return op;
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
    throw new UnsupportedError('Window functions not supported');
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
