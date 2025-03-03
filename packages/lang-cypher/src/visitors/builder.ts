import {
  Aliased,
  allAttrs,
  ASTFunction,
  ASTIdentifier,
  ASTLiteral,
  ASTNode,
  ASTOperator,
  boundParam,
  CalculationParams,
  DortDBAsFriend,
  IdSet,
  LangSwitch,
  LogicalPlanBuilder,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
  LogicalPlanVisitor,
  toInfer,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import * as AST from '../ast/index.js';
import { CypherVisitor } from '../ast/visitor.js';
import { ASTDeterministicStringifier } from './ast-stringifier.js';
import { unwind } from '@dortdb/core/fns';
import { CypherDataAdaper } from 'src/language/data-adapter.js';
import { CypherLanguage } from 'src/language/language.js';
import { Trie } from '@dortdb/core/data-structures';
import { isEqual, isMatch } from 'lodash-es';

function idToPair(id: ASTIdentifier): [string, string] {
  return [
    id.parts[id.parts.length - 1] as string,
    id.parts[id.parts.length - 2] as string,
  ];
}
function toId(name: string | symbol): ASTIdentifier {
  return ASTIdentifier.fromParts([name]);
}
function infer(item: ASTIdentifier, args: DescentArgs) {
  if (item.parts[0] !== boundParam && !args.ctx.has(item.parts)) {
    if (item.parts.length > 1 && args.ctx.has([item.parts[0], toInfer])) {
      args.inferred.add(item.parts);
    }
  }
  return item;
}
interface DescentArgs {
  src?: LogicalPlanTupleOperator;
  ctx: IdSet;
  inferred: IdSet;
}

export class CypherLogicalPlanBuilder
  implements LogicalPlanBuilder, CypherVisitor<LogicalPlanOperator, DescentArgs>
{
  private calcBuilders: Record<string, LogicalPlanVisitor<CalculationParams>>;
  private stringifier = new ASTDeterministicStringifier();
  private dataAdapter: CypherDataAdaper;
  private graphName: ASTIdentifier;

  constructor(private db: DortDBAsFriend) {
    this.calcBuilders = db.langMgr.getVisitorMap('calculationBuilder');
    const lang = db.langMgr.getLang<'cypher', CypherLanguage>('cypher');
    this.dataAdapter = lang.dataAdapter;
    this.graphName = lang.defaultGraph;
  }

  private toCalc(
    node: ASTNode,
    args: DescentArgs,
  ): plan.Calculation | ASTIdentifier {
    if (node instanceof ASTIdentifier) return infer(node, args);
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
      ? infer(item, args)
      : { op: item.accept(this, args) };
  }
  private processAttr(
    attr: ASTNode | Aliased<ASTNode>,
    args: DescentArgs,
  ): Aliased<ASTIdentifier | plan.Calculation> {
    if (attr instanceof ASTIdentifier) {
      return [infer(attr, args), attr];
    }
    if (Array.isArray(attr)) {
      return [this.toCalc(attr[0], args), attr[1]];
    }
    const alias = toId(attr.accept(this.stringifier));
    return [this.toCalc(attr, args), alias];
  }

  buildPlan(node: ASTNode, ctx: IdSet) {
    const inferred = new Trie<string | symbol>();
    return { plan: node.accept(this, { ctx, inferred }), inferred };
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
    const impl = this.db.langMgr.getFnOrAggr('sql', id, schema);

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
    const impl = this.db.langMgr.getFn('sql', id, schema);
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
          this.db.langMgr.getAggr('cypher', 'count'),
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
            this.db.langMgr.getAggr('cypher', 'count'),
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

  private preparePatternRefs(
    refVars: ASTIdentifier[],
    chain: (AST.NodePattern | AST.RelPattern)[],
    isRef: boolean[],
    args: DescentArgs,
  ): LogicalPlanTupleOperator {
    if (refVars.length) {
      let res =
        args.src ??
        new plan.TupleFnSource('cypher', refVars, (...args) => {
          const res = new Trie<string | symbol, unknown>();
          for (let i = 0; i < refVars.length; i++) {
            res.set(refVars[i].parts, args[i]);
          }
          return [res];
        });
      for (let i = 0; i < chain.length; i++) {
        if (isRef[i] && chain[i].props) {
          res = this.patternToSelection(res, refVars[i], chain[i], args);
        }
      }
    }
    return null;
  }
  private patternToSelection(
    src: LogicalPlanTupleOperator,
    variable: ASTIdentifier,
    el: AST.NodePattern | AST.RelPattern,
    args: DescentArgs,
  ) {
    const graphName = this.graphName;
    if (el.props instanceof AST.ASTParameter) {
      return new plan.Selection(
        'cypher',
        new plan.Calculation(
          'cypher',
          (v, p) => {
            const nodeProps = this.dataAdapter[
              el instanceof AST.NodePattern
                ? 'getNodeProperties'
                : 'getEdgeProperties'
            ](this.db.getSource(graphName.parts), v);
            return isEqual(nodeProps, p);
          },
          [variable, el.props],
        ),
        src,
      );
    }

    const fn = new plan.FnCall(
      'cypher',
      [variable, { op: this.visitMapLiteral(el.props, args) }],
      (v, p) => {
        const nodeProps = this.dataAdapter[
          el instanceof AST.NodePattern
            ? 'getNodeProperties'
            : 'getEdgeProperties'
        ](this.db.getSource(graphName.parts), v);
        return isMatch(nodeProps, p);
      },
    );
    const calcParams = this.calcBuilders['cypher'].visitFnCall(fn);
    return new plan.Selection(
      'cypher',
      new plan.Calculation('cypher', calcParams.impl, calcParams.args),
      src,
    );
  }

  private setupChainSelections(
    chain: (AST.NodePattern | AST.RelPattern)[],
    variables: ASTIdentifier[],
    res: LogicalPlanTupleOperator,
  ) {
    const graphName = this.graphName;
    for (let i = 1; i < chain.length; i += 2) {
      const edge = chain[i] as AST.RelPattern;
      const edgeDir1 = edge.pointsLeft
        ? 'in'
        : edge.pointsRight
          ? 'out'
          : 'any';
      const edgeDir2 = edge.pointsLeft
        ? 'out'
        : edge.pointsRight
          ? 'in'
          : 'any';
      res = new plan.Selection(
        'cypher',
        new plan.Calculation(
          'cypher',
          (n, e) =>
            this.dataAdapter.isConnected(
              this.db.getSource(graphName.parts),
              e,
              n,
              edgeDir1,
            ),
          [variables[i - 1], variables[i]],
        ),
        res,
      );
      res = new plan.Selection(
        'cypher',
        new plan.Calculation(
          'cypher',
          (n, e) =>
            this.dataAdapter.isConnected(
              this.db.getSource(graphName.parts),
              e,
              n,
              edgeDir2,
            ),
          [variables[i + 1], variables[i]],
        ),
        res,
      );
    }

    const nodeVars = variables.filter((_, i) => i % 2 === 0);
    const edgeVars = variables.filter((_, i) => i % 2 === 1);

    for (let i = 2; i < chain.length; i++) {
      res = new plan.Selection(
        'cypher',
        new plan.Calculation(
          'cypher',
          (...args) => {
            const last = args.pop();
            return args.every((arg) => arg !== last);
          },
          (i % 2 ? edgeVars : nodeVars).slice(0, i / 2),
        ),
        res,
      );
    }
    return res;
  }

  visitPatternElChain(
    node: AST.PatternElChain,
    args: DescentArgs,
  ): LogicalPlanOperator {
    const varPrefix = Symbol('unnamed');
    const variables = node.chain.map(
      (item, i) =>
        item.variable ?? ASTIdentifier.fromParts([varPrefix, i + '']),
    );
    const isRef = node.chain.map((item) => {
      if (!item.variable) return false;
      infer(item.variable, args);
      return (
        item.variable.parts[0] === boundParam ||
        args.ctx.has(item.variable.parts) ||
        item.variable.parts[item.variable.parts.length - 1] === toInfer
      );
    });
    let res = this.preparePatternRefs(variables, node.chain, isRef, args);
    let firstUnknown = isRef.findIndex((x) => !x);
    if (firstUnknown > -1) {
      if (!res) {
        res = node.chain[firstUnknown].accept(this, {
          ...args,
          variable: variables[firstUnknown],
        } as DescentArgs & {
          variable: ASTIdentifier;
        }) as LogicalPlanTupleOperator;
        firstUnknown++;
      }
      for (let i = firstUnknown; i < node.chain.length; i++) {
        if (isRef[i]) continue;
        const nextPart = node.chain[i].accept(this, {
          ...args,
          variable: variables[i],
        } as DescentArgs & {
          variable: ASTIdentifier;
        }) as LogicalPlanTupleOperator;
        res = new plan.CartesianProduct('cypher', res, nextPart);
      }
    }

    res = this.setupChainSelections(node.chain, variables, res);
    const cols = res.schema
      .filter((x) => x.parts[0] !== varPrefix)
      .map((col) => [col, col]) as Aliased<ASTIdentifier | plan.Calculation>[];
    if (!node.variable && cols.length === res.schema.length) return res;
    if (node.variable) {
      cols.push([
        new plan.Calculation('cypher', (...args) => args, variables),
        node.variable,
      ]);
    }
    res = new plan.Projection('cypher', cols, res);

    return res;
  }
  visitParameter(
    node: AST.ASTParameter,
    args: DescentArgs,
  ): LogicalPlanOperator {
    return this.visitIdentifier(node, args);
  }
  visitNodePattern(
    node: AST.NodePattern,
    args: DescentArgs & { variable: ASTIdentifier },
  ): LogicalPlanTupleOperator {
    const graphName = this.graphName;
    const src = new plan.ItemSource(
      'cypher',
      ASTIdentifier.fromParts(this.graphName.parts.concat('nodes')),
    );
    let res: LogicalPlanTupleOperator = new plan.MapFromItem(
      'cypher',
      args.variable,
      src,
    );
    if (node.labels) {
      res = new plan.Selection(
        'cypher',
        new plan.Calculation(
          'cypher',
          (n) => {
            node.labels.every((l) =>
              this.dataAdapter.hasLabel(
                this.db.getSource(graphName.parts),
                n,
                l.parts[0] as string,
              ),
            );
          },
          [args.variable],
        ),
        res,
      );
    }
    if (node.props) {
      res = this.patternToSelection(res, args.variable, node, args);
    }
    return res;
  }
  visitRelPattern(
    node: AST.RelPattern,
    args: DescentArgs & { variable: ASTIdentifier },
  ): LogicalPlanTupleOperator {
    const graphName = this.graphName;
    const src = new plan.ItemSource(
      'cypher',
      ASTIdentifier.fromParts(this.graphName.parts.concat('edges')),
    );
    let res: LogicalPlanTupleOperator = new plan.MapFromItem(
      'cypher',
      args.variable,
      src,
    );
    if (node.types.length) {
      res = new plan.Selection(
        'cypher',
        new plan.Calculation(
          'cypher',
          (e) => {
            node.types.some((t) =>
              this.dataAdapter.hasType(
                this.db.getSource(graphName.parts),
                e,
                t.parts[0] as string,
              ),
            );
          },
          [args.variable],
        ),
        res,
      );
    }
    if (node.props) {
      res = this.patternToSelection(res, args.variable, node, args);
    }
    return res;
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
    if (node.from) {
      this.graphName = node.from;
    } else if (!this.graphName) {
      throw new Error('No graph specified');
    }
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
