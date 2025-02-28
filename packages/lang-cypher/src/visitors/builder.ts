import {
  Aliased,
  allAttrs,
  ASTFunction,
  ASTIdentifier,
  ASTLiteral,
  ASTNode,
  ASTOperator,
  CalculationParams,
  IdSet,
  LangSwitch,
  LanguageManager,
  LogicalPlanBuilder,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import * as AST from '../ast/index.js';
import { CypherVisitor } from '../ast/visitor.js';
import { ASTDeterministicStringifier } from './ast-stringifier.js';
import { unwind } from '@dortdb/core/fns';
import { CypherDataAdaper } from 'src/language/data-adapter.js';
import { CypherLanguage } from 'src/language/language.js';

function idToPair(id: ASTIdentifier): [string, string] {
  return [
    id.parts[id.parts.length - 1] as string,
    id.parts[id.parts.length - 2] as string,
  ];
}
function toId(name: string | symbol): ASTIdentifier {
  return ASTIdentifier.fromParts([name]);
}
interface DescentArgs {
  src?: LogicalPlanTupleOperator;
  ctx: IdSet;
}

export class CypherLogicalPlanBuilder
  implements LogicalPlanBuilder, CypherVisitor<LogicalPlanOperator, DescentArgs>
{
  private calcBuilders: Record<string, LogicalPlanVisitor<CalculationParams>>;
  private stringifier = new ASTDeterministicStringifier();
  private dataAdapter: CypherDataAdaper;

  constructor(private langMgr: LanguageManager) {
    this.calcBuilders = langMgr.getVisitorMap('calculationBuilder');
    this.dataAdapter = langMgr.getLang<'cypher', CypherLanguage>(
      'cypher',
    ).dataAdapter;
  }

  private toCalc(
    node: ASTNode,
    args: DescentArgs,
  ): plan.Calculation | ASTIdentifier {
    if (node instanceof ASTIdentifier) return node;
    const calcParams = node.accept(this, args).accept(this.calcBuilders);
    return new plan.Calculation(
      'cypher',
      calcParams.impl,
      calcParams.args,
      calcParams.aggregates,
      calcParams.literal,
    );
  }
  private processFnArg(
    item: ASTNode,
    args: DescentArgs,
  ): plan.PlanOpAsArg | ASTIdentifier {
    return item instanceof ASTIdentifier
      ? item
      : { op: item.accept(this, args) };
  }
  private processAttr(
    attr: ASTNode | Aliased<ASTNode>,
    args: DescentArgs,
  ): Aliased<ASTIdentifier | plan.Calculation> {
    if (attr instanceof ASTIdentifier) {
      return [attr, attr];
    }
    if (Array.isArray(attr)) {
      return [this.toCalc(attr[0], args), attr[1]];
    }
    const alias = toId(attr.accept(this.stringifier));
    return [this.toCalc(attr, args), alias];
  }

  buildPlan(node: ASTNode, ctx: IdSet) {
    return { plan: node.accept(this, { ctx }), inferred: ctx };
  }
  visitCypherIdentifier(
    node: AST.CypherIdentifier,
    args: DescentArgs,
  ): LogicalPlanOperator {
    return this.visitIdentifier(node, args);
  }
  visitStringLiteral(node: AST.ASTStringLiteral): LogicalPlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  visitNumberLiteral(node: AST.ASTNumberLiteral): LogicalPlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  visitListLiteral(
    node: AST.ASTListLiteral,
    args: DescentArgs,
  ): LogicalPlanOperator {
    return new plan.FnCall(
      'cypher',
      node.items.map((item) => this.processFnArg(item, args)),
      Array.of,
    );
  }
  visitMapLiteral(
    node: AST.ASTMapLiteral,
    args: DescentArgs,
  ): LogicalPlanOperator {
    const names = node.items.map((i) => i[1].parts[0]);
    const values = node.items.map((i) => this.processFnArg(i[1], args));
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
  visitFnCallWrapper(
    node: AST.FnCallWrapper,
    args: DescentArgs,
  ): LogicalPlanOperator {
    if (node.procedure) return this.visitProcedure(node, args);
    const [id, schema] = idToPair(node.fn.id);
    const impl = this.langMgr.getFnOrAggr('sql', id, schema);

    if ('init' in impl) {
      const res = new plan.AggregateCall(
        'cypher',
        node.fn.args.map((arg) => this.toCalc(arg, args)),
        impl,
        ASTIdentifier.fromParts([this.stringifier.visitFnCallWrapper(node)]),
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
      node.fn.args.map((arg) => this.processFnArg(arg, args)),
      impl.impl,
      impl.pure,
    );
  }

  private visitProcedure(
    node: AST.FnCallWrapper,
    args: DescentArgs,
  ): LogicalPlanOperator {
    const [id, schema] = idToPair(node.fn.id);
    const impl = this.langMgr.getFn('sql', id, schema);
    let res: LogicalPlanTupleOperator = new plan.TupleFnSource(
      'cypher',
      node.fn.args.map((arg) => this.toCalc(arg, args)),
      impl.impl,
      node.fn.id,
    );
    if (impl.outputSchema) res.addToSchema(impl.outputSchema);
    if (node.yieldItems && node.yieldItems !== '*') {
      res = new plan.Projection(
        'cypher',
        node.yieldItems.map((item) => this.processAttr(item, args)),
        res,
      );
    }
    if (node.where) {
      res = new plan.Selection('cypher', this.toCalc(node.where, args), res);
    }
    return res;
  }

  visitExistsSubquery(
    node: AST.ExistsSubquery,
    args: DescentArgs,
  ): LogicalPlanOperator {
    let res = node.query.accept(this, args) as LogicalPlanOperator;
    res = new plan.Limit('cypher', 0, 1, res);
    const col = toId('count');
    res = new plan.GroupBy(
      'cypher',
      [],
      [
        new plan.AggregateCall(
          'cypher',
          [toId(allAttrs)],
          this.langMgr.getAggr('cypher', 'count'),
          col,
        ),
      ],
      res as plan.Limit,
    );
    res = new plan.MapToItem('cypher', col, res as plan.GroupBy);
    return new plan.FnCall('cypher', [{ op: res }], (x) => x > 0);
  }
  visitQuantifiedExpr(
    node: AST.QuantifiedExpr,
    args: DescentArgs,
  ): LogicalPlanOperator {
    let res: LogicalPlanTupleOperator = new plan.MapFromItem(
      'cypher',
      node.variable,
      new plan.ItemFnSource(
        'cypher',
        [this.toCalc(node.expr, args)],
        unwind.impl,
        toId('unwind'),
      ),
    );

    if (node.quantifier === AST.Quantifier.SINGLE) {
      res = new plan.GroupBy(
        'cypher',
        [],
        [
          new plan.AggregateCall(
            'cypher',
            [node.variable],
            this.langMgr.getAggr('cypher', 'count'),
            node.variable,
          ),
        ],
        res,
      );
      return new plan.FnCall(
        'cypher',
        [{ op: new plan.MapToItem('cypher', node.variable, res) }],
        (x) => x === 1,
      );
    }

    const invertCond = node.quantifier === AST.Quantifier.ALL;
    const invertRes =
      node.quantifier === AST.Quantifier.ANY ||
      node.quantifier === AST.Quantifier.NONE;

    let cond = this.toCalc(node.where ?? node.variable, args);
    if (invertCond) {
      if (cond instanceof ASTIdentifier) {
        cond = new plan.Calculation('cypher', (x) => !x, [cond]);
      } else {
        cond.impl = (...args) => !(cond as plan.Calculation).impl(...args);
      }
    }
    res = new plan.Selection('cypher', cond, res);
    res = new plan.Limit('cypher', 0, 1, res);
    res = new plan.Projection(
      'cypher',
      [[new plan.Calculation('cypher', () => invertRes, []), node.variable]],
      res,
    );
    return res;
  }

  visitPatternElChain(
    node: AST.PatternElChain,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitParameter(
    node: AST.ASTParameter,
    args: DescentArgs,
  ): LogicalPlanOperator {
    return this.visitIdentifier(node, args);
  }
  visitNodePattern(
    node: AST.NodePattern,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitRelPattern(
    node: AST.RelPattern,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitPatternComprehension(
    node: AST.PatternComprehension,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitListComprehension(
    node: AST.ListComprehension,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCaseExpr(node: AST.CaseExpr, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCountAll(node: AST.CountAll, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLabelFilterExpr(
    node: AST.LabelFilterExpr,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSubscriptExpr(
    node: AST.SubscriptExpr,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitPropLookup(
    node: AST.PropLookup,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSetOp(node: AST.SetOp, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitQuery(node: AST.Query, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitMatchClause(
    node: AST.MatchClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitUnwindClause(
    node: AST.UnwindClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCreateClause(
    node: AST.CreateClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitMergeClause(
    node: AST.MergeClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSetClause(node: AST.SetClause, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSetItem(node: AST.SetItem, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitRemoveClause(
    node: AST.RemoveClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitRemoveItem(
    node: AST.RemoveItem,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitDeleteClause(
    node: AST.DeleteClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitProjectionBody(
    node: AST.ProjectionBody,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitOrderItem(node: AST.OrderItem, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitWithClause(
    node: AST.WithClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitReturnClause(
    node: AST.ReturnClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLiteral<T>(node: ASTLiteral<T>, args: DescentArgs): LogicalPlanOperator {
    return new plan.Literal('cypher', node.value);
  }
  visitOperator(node: ASTOperator, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitFunction(node: ASTFunction, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLangSwitch(node: LangSwitch, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitIdentifier(node: ASTIdentifier, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
}
