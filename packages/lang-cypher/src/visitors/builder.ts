import {
  ASTFunction,
  ASTIdentifier,
  ASTLiteral,
  ASTNode,
  ASTOperator,
  CalculationParams,
  LangSwitch,
  LanguageManager,
  LogicalPlanBuilder,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import * as AST from 'src/ast/index.js';
import { CypherVisitor } from 'src/ast/visitor.js';

function idToPair(id: ASTIdentifier): [string, string] {
  return [
    id.parts[id.parts.length - 1] as string,
    id.parts[id.parts.length - 2] as string,
  ];
}

export class CypherLogicalPlanBuilder
  implements
    LogicalPlanBuilder,
    CypherVisitor<LogicalPlanOperator, LogicalPlanTupleOperator>
{
  private calcBuilders: Record<string, LogicalPlanVisitor<CalculationParams>>;

  constructor(private langMgr: LanguageManager) {
    this.calcBuilders = langMgr.getVisitorMap('calculationBuilder');
    this.processFnArg = this.processFnArg.bind(this);
    this.toCalc = this.toCalc.bind(this);
  }

  private toCalc(node: ASTNode): plan.Calculation | ASTIdentifier {
    if (node instanceof ASTIdentifier) return node;
    const calcParams = node.accept(this).accept(this.calcBuilders);
    return new plan.Calculation(
      'cypher',
      calcParams.impl,
      calcParams.args,
      calcParams.aggregates,
      calcParams.literal,
    );
  }
  private processFnArg(item: ASTNode): plan.PlanOpAsArg | ASTIdentifier {
    return item instanceof ASTIdentifier ? item : { op: item.accept(this) };
  }

  buildPlan(node: ASTNode): LogicalPlanOperator {
    return node.accept(this);
  }
  visitCypherIdentifier(node: AST.CypherIdentifier): LogicalPlanOperator {
    return this.visitIdentifier(node);
  }
  visitStringLiteral(node: AST.ASTStringLiteral): LogicalPlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  visitNumberLiteral(node: AST.ASTNumberLiteral): LogicalPlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  visitListLiteral(node: AST.ASTListLiteral): LogicalPlanOperator {
    return new plan.FnCall(
      'cypher',
      node.items.map(this.processFnArg),
      Array.of,
    );
  }
  visitMapLiteral(node: AST.ASTMapLiteral): LogicalPlanOperator {
    const names = node.items.map((i) => i[1].parts[0]);
    const values = node.items.map((i) => this.processFnArg(i[1]));
    return new plan.FnCall('cypher', values, (...vals) => {
      const res: Record<string | symbol, unknown> = {};
      for (let i = 0; i < vals.length; i++) {
        res[names[i]] = vals[i + 1];
      }
      return res;
    });
  }
  visitBooleanLiteral(node: AST.ASTBooleanLiteral): LogicalPlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  visitFnCallWrapper(node: AST.FnCallWrapper): LogicalPlanOperator {
    if (node.procedure) return this.visitProcedure(node);
    const [id, schema] = idToPair(node.fn.id);
    const impl = this.langMgr.getFnOrAggr('sql', id, schema);

    if ('init' in impl) {
      const res = new plan.AggregateCall(
        'cypher',
        node.fn.args.map(this.toCalc),
        impl,
        ASTIdentifier.fromParts([this.stringifier.visitFunction(node)]),
      );
      if (node.distinct) {
        res.postGroupOp = new plan.Distinct(
          'cypher',
          res.args,
          res.postGroupOp,
        );
      }
      return res;
    }
    return new plan.FnCall(
      'cypher',
      node.fn.args.map(this.processFnArg),
      impl.impl,
      impl.pure,
    );
  }

  private visitProcedure(node: AST.FnCallWrapper): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }

  visitExistsSubquery(
    node: AST.ExistsSubquery,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitQuantifiedExpr(
    node: AST.QuantifiedExpr,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitPatternElChain(
    node: AST.PatternElChain,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitParameter(
    node: AST.ASTParameter,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitNodePattern(
    node: AST.NodePattern,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitRelPattern(
    node: AST.RelPattern,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitPatternComprehension(
    node: AST.PatternComprehension,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitListComprehension(
    node: AST.ListComprehension,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCaseExpr(
    node: AST.CaseExpr,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCountAll(
    node: AST.CountAll,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLabelFilterExpr(
    node: AST.LabelFilterExpr,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSubscriptExpr(
    node: AST.SubscriptExpr,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitPropLookup(
    node: AST.PropLookup,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSetOp(
    node: AST.SetOp,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitQuery(
    node: AST.Query,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitMatchClause(
    node: AST.MatchClause,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitUnwindClause(
    node: AST.UnwindClause,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCreateClause(
    node: AST.CreateClause,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitMergeClause(
    node: AST.MergeClause,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSetClause(
    node: AST.SetClause,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSetItem(
    node: AST.SetItem,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitRemoveClause(
    node: AST.RemoveClause,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitRemoveItem(
    node: AST.RemoveItem,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitDeleteClause(
    node: AST.DeleteClause,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitProjectionBody(
    node: AST.ProjectionBody,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitOrderItem(
    node: AST.OrderItem,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitWithClause(
    node: AST.WithClause,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitReturnClause(
    node: AST.ReturnClause,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLiteral<T>(
    node: ASTLiteral<T>,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    return new plan.Literal('cypher', node.value);
  }
  visitOperator(
    node: ASTOperator,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitFunction(
    node: ASTFunction,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLangSwitch(
    node: LangSwitch,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitIdentifier(
    node: ASTIdentifier,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
}
