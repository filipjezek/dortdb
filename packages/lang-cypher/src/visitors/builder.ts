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
  UnsupportedError,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import * as AST from '../ast/index.js';
import { CypherVisitor } from '../ast/visitor.js';
import { ASTDeterministicStringifier } from './ast-stringifier.js';
import { unwind } from '@dortdb/core/fns';
import { CypherDataAdaper, EdgeDirection } from '../language/data-adapter.js';
import { CypherLanguage } from '../language/language.js';
import { Trie } from '@dortdb/core/data-structures';
import { isEqual, isMatch } from 'lodash-es';
import { ret1, toPair } from '@dortdb/core/internal-fns';
import { assertCalcLiteral, schemaToTrie, union } from '@dortdb/core/utils';

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
function getAggrs([item]: Aliased<
  plan.Calculation | ASTIdentifier
>): plan.AggregateCall[] {
  return item instanceof plan.Calculation ? (item.aggregates ?? []) : [];
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
  private processNode(node: ASTNode, args: DescentArgs) {
    return node instanceof ASTIdentifier
      ? infer(node, args)
      : node.accept(this, args);
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
    const values = node.items.map((i) => this.processFnArg(i[0], args));
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
    const impl = this.db.langMgr.getFnOrAggr('cypher', id, schema);

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
    const impl = this.db.langMgr.getFn('cypher', id, schema);
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
      let res: LogicalPlanTupleOperator =
        args.src ??
        new plan.TupleFnSource('cypher', refVars, (...args) => {
          const res = new Trie<string | symbol, unknown>();
          for (let i = 0; i < refVars.length; i++) {
            res.set(refVars[i].parts, args[i]);
          }
          return [res];
        });
      for (let i = 0, j = 0; i < chain.length; i++) {
        if (isRef[i]) {
          res = this.patternToSelection(res, refVars[j++], chain[i], args);
        }
      }
      return res;
    }
    return args.src;
  }
  private patternToSelection(
    src: LogicalPlanTupleOperator,
    variable: ASTIdentifier,
    el: AST.NodePattern | AST.RelPattern,
    args: DescentArgs,
  ) {
    if (!el.props) return src;
    const graphName = this.graphName;
    if (el.props instanceof ASTIdentifier) {
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
      res = this.isEdgeConnected(
        res,
        edgeDir1,
        variables[i - 1],
        variables[i],
        true,
      );
      res = this.isEdgeConnected(
        res,
        edgeDir2,
        variables[i + 1],
        variables[i],
        false,
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
          (i % 2 ? edgeVars : nodeVars).slice(0, i / 2 + 1),
        ),
        res,
      );
    }
    return res;
  }
  private isEdgeConnected(
    res: LogicalPlanTupleOperator,
    dir: EdgeDirection,
    node: ASTIdentifier,
    edge: ASTIdentifier,
    /** if edge resolves to an array (e.g. for recursive edge), pick first or last item? */
    pickFirstEdge: boolean,
  ) {
    const graphName = this.graphName;
    return new plan.Selection(
      'cypher',
      new plan.Calculation(
        'cypher',
        (n, e) =>
          this.dataAdapter.isConnected(
            this.db.getSource(graphName.parts),
            Array.isArray(e) ? (pickFirstEdge ? e[0] : e[e.length - 1]) : e,
            n,
            dir,
          ),
        [node, edge],
      ),
      res,
    );
  }

  visitPatternElChain(
    node: AST.PatternElChain,
    args: DescentArgs,
  ): LogicalPlanTupleOperator {
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
        args.src?.schemaSet.has(item.variable.parts) ||
        item.variable.parts[item.variable.parts.length - 1] === toInfer
      );
    });
    const ctx = args.src ? union(args.ctx, args.src.schema) : args.ctx;
    let res = this.preparePatternRefs(
      variables.filter((_, i) => isRef[i]),
      node.chain,
      isRef,
      {
        ...args,
        ctx,
      },
    );
    let firstUnknown = isRef.findIndex((x) => !x);
    if (firstUnknown > -1) {
      if (!res) {
        res = node.chain[firstUnknown].accept(this, {
          ...args,
          variable: variables[firstUnknown],
          ctx,
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
          ctx,
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
    if (node.labels.length) {
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
    if (node.range) {
      res = this.addRecursion(node, args.variable, res);
    }
    return res;
  }
  private addRecursion(
    edge: AST.RelPattern,
    variable: ASTIdentifier,
    source: LogicalPlanTupleOperator,
  ) {
    const min = edge.range[0]?.value ?? 1;
    const max = edge.range[1]?.value ?? Infinity;
    const graphName = this.graphName;
    const calc = new plan.Calculation(
      'cypher',
      ([e1, e2]) => {
        const g = this.db.getSource(graphName.parts);
        let res = true;
        if (!edge.pointsLeft) {
          res &&=
            this.dataAdapter.getEdgeNode(g, e1, 'target') ===
            this.dataAdapter.getEdgeNode(g, e2, 'source');
        }
        if (!edge.pointsRight) {
          res &&=
            this.dataAdapter.getEdgeNode(g, e1, 'source') ===
            this.dataAdapter.getEdgeNode(g, e2, 'target');
        }
        return res;
      },
      [variable],
    );
    return new plan.Recursion('cypher', min, max, calc, source);
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
    return new plan.Conditional(
      'cypher',
      node.expr && this.processNode(node.expr, args),
      node.whenThens.map(([w, t]) => [
        this.processNode(w, args),
        this.processNode(t, args),
      ]),
      node.elseExpr && this.processNode(node.elseExpr, args),
    );
  }
  visitCountAll(node: AST.CountAll, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLabelFilterExpr(
    node: AST.LabelFilterExpr,
    args: DescentArgs,
  ): LogicalPlanOperator {
    const graphName = this.graphName;
    return new plan.FnCall(
      'cypher',
      [this.processFnArg(node.expr, args)],
      (n) =>
        node.labels.every((l) =>
          this.dataAdapter.hasLabel(
            this.db.getSource(graphName.parts),
            n,
            l.parts[0] as string,
          ),
        ),
    );
  }
  visitSubscriptExpr(
    node: AST.SubscriptExpr,
    args: DescentArgs,
  ): LogicalPlanOperator {
    const indices = node.subscript
      .filter(ret1)
      .map((x) => this.processFnArg(x, args));
    indices.unshift(this.processFnArg(node.expr, args));
    return new plan.FnCall(
      'cypher',
      indices,
      node.subscript.length === 2
        ? (e, f, t) => e.slice(f ?? 0, t ?? e.length)
        : (e, i) => e[i],
    );
  }
  visitPropLookup(
    node: AST.PropLookup,
    args: DescentArgs,
  ): LogicalPlanOperator {
    return new plan.FnCall(
      'cypher',
      [this.processFnArg(node.expr, args)],
      (n) => {
        for (const part of node.prop.parts) {
          n = n[part];
        }
        return n;
      },
    );
  }
  visitSetOp(node: AST.SetOp, args: DescentArgs): LogicalPlanTupleOperator {
    let next = node.next.accept(this, args) as LogicalPlanTupleOperator;
    next = new plan.Union('cypher', args.src, next);
    if (node.type === AST.SetOpType.UNIONALL) {
      next = new plan.Distinct('cypher', allAttrs, next);
    }
    return next;
  }
  visitQuery(node: AST.Query, args: DescentArgs): LogicalPlanTupleOperator {
    if (node.from) {
      this.graphName = node.from;
    } else if (!this.graphName) {
      throw new Error('No graph specified');
    }
    let res = node.statements[0].accept(this, args) as LogicalPlanTupleOperator;
    for (let i = 1; i < node.statements.length; i++) {
      res = node.statements[i].accept(this, {
        ...args,
        src: res,
      }) as LogicalPlanTupleOperator;
    }
    if (node.setOp) {
      res = this.visitSetOp(node.setOp, { ...args, src: res });
    }
    return res;
  }
  visitMatchClause(
    node: AST.MatchClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    let res = this.visitPatternElChain(node.pattern[0], args);
    for (let i = 1; i < node.pattern.length; i++) {
      res = this.visitPatternElChain(node.pattern[i], { ...args, src: res });
    }
    if (node.where) {
      res = new plan.Selection(
        'cypher',
        this.toCalc(node.where, { ...args, ctx: union(args.ctx, res.schema) }),
        res,
      );
    }
    if (node.optional) {
      res = new plan.Join(
        'cypher',
        new plan.NullSource('cypher'),
        res,
        new plan.Calculation('cypher', () => true, [], [], true),
      );
      (res as plan.Join).leftOuter = (res as plan.Join).rightOuter = true;
    }
    return res;
  }
  visitUnwindClause(
    node: AST.UnwindClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    const unwound = new plan.ItemFnSource(
      'cypher',
      [
        this.toCalc(node.expr, {
          ...args,
          ctx: union(args.ctx, args.src?.schema ?? []),
        }),
      ],
      unwind.impl,
      toId('unwind'),
    );
    const renamed = new plan.MapFromItem('cypher', node.variable, unwound);
    if (!args.src) return renamed;
    return new plan.ProjectionConcat(
      'cypher',
      new plan.MapFromItem('cypher', node.variable, renamed),
      false,
      args.src,
    );
  }
  visitCreateClause(
    node: AST.CreateClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new UnsupportedError('Only read operations are supported');
  }
  visitMergeClause(
    node: AST.MergeClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new UnsupportedError('Only read operations are supported');
  }
  visitSetClause(node: AST.SetClause, args: DescentArgs): LogicalPlanOperator {
    throw new UnsupportedError('Only read operations are supported');
  }
  visitSetItem(node: AST.SetItem, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitRemoveClause(
    node: AST.RemoveClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    throw new UnsupportedError('Only read operations are supported');
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
    throw new UnsupportedError('Only read operations are supported');
  }
  visitProjectionBody(
    node: AST.ProjectionBody,
    args: DescentArgs & { append: boolean },
  ): LogicalPlanTupleOperator {
    let res = args.src ?? new plan.NullSource('cypher');
    const originalSchema = res.schema;
    const attrCtx = union(args.ctx, res.schema);
    if (node.order?.length) {
      res = this.processOrderBy(node, res, { ...args, ctx: attrCtx });
    }
    if (node.items === '*') {
      res = new plan.Projection('cypher', originalSchema.map(toPair), res);
    } else {
      const cols: Aliased<plan.Calculation | ASTIdentifier>[] = node.items.map(
        (item) => this.processAttr(item, { ...args, ctx: attrCtx }),
      );
      const aggrs = cols.flatMap(getAggrs);
      if (!node.order?.length && aggrs.length) {
        res = this.processGroupBy(res, aggrs, cols);
      }
      res = new plan.Projection(
        'cypher',
        args.append
          ? originalSchema
              .map<Aliased<plan.Calculation | ASTIdentifier>>(toPair)
              .concat(cols)
          : cols,
        res,
      );
    }
    if (node.distinct) {
      res = new plan.Distinct('cypher', allAttrs, res);
    }
    if (node.limit || node.skip) {
      res = this.buildLimit(node, res, args);
    }
    return res;
  }
  private processOrderBy(
    node: AST.ProjectionBody,
    res: LogicalPlanTupleOperator,
    args: DescentArgs & { append: boolean },
  ) {
    let preSortCols: Aliased<plan.Calculation | ASTIdentifier>[];
    if (node.items === '*') {
      preSortCols = res.schema.map(toPair);
    } else {
      preSortCols = args.append ? res.schema.map(toPair) : [];
      for (const item of node.items) {
        preSortCols.push(this.processAttr(item, args));
      }
    }
    const orders: plan.Order[] = [];
    for (const item of node.order) {
      const col = this.toCalc(item.expr, args);
      if (col instanceof plan.Calculation) {
        const name = toId(item.expr.accept(this.stringifier));
        preSortCols.push([col, name]);
        orders.push({
          ascending: item.ascending,
          key: name,
          nullsFirst: false,
        });
      } else {
        orders.push({ ascending: item.ascending, key: col, nullsFirst: false });
      }
    }
    const aggrs = preSortCols.flatMap(getAggrs);
    if (aggrs.length) {
      res = this.processGroupBy(res, aggrs, preSortCols);
    } else {
      res = new plan.Projection('cypher', preSortCols, res);
    }
    return new plan.OrderBy('cypher', orders, res);
  }
  private processGroupBy(
    res: LogicalPlanTupleOperator,
    aggrs: plan.AggregateCall[],
    allCols: Aliased<plan.Calculation | ASTIdentifier>[],
  ): LogicalPlanTupleOperator {
    const aggrSet = schemaToTrie(aggrs.map((x) => x.fieldName));
    const groupByCols: Aliased<plan.Calculation | ASTIdentifier>[] = [];
    for (const col of allCols) {
      if (!aggrSet.has(col[1].parts)) {
        groupByCols.push(col);
      }
    }
    for (const aggr of aggrs) {
      aggr.postGroupSource.addToSchema(res.schema);
    }

    return new plan.GroupBy('cypher', groupByCols, aggrs, res);
  }
  private buildLimit(
    node: AST.ProjectionBody,
    res: LogicalPlanTupleOperator,
    args: DescentArgs,
  ) {
    const limit = node.limit && this.toCalc(node.limit, args);
    const offset = node.skip && this.toCalc(node.skip, args);
    if (limit && !assertCalcLiteral(limit, 'number'))
      throw new Error('Limit must be a number constant');
    if (offset && !assertCalcLiteral(offset, 'number'))
      throw new Error('Offset must be a number constant');
    return new plan.Limit(
      'sql',
      offset ? (offset as plan.Calculation).impl() : 0,
      limit ? (limit as plan.Calculation).impl() : Infinity,
      res,
    );
  }

  visitOrderItem(node: AST.OrderItem, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitWithClause(
    node: AST.WithClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    let res = this.visitProjectionBody(node.body, { ...args, append: true });
    if (node.where) {
      res = new plan.Selection(
        'cypher',
        this.toCalc(node.where, {
          ...args,
          ctx: union(args.ctx, res.schemaSet),
        }),
        res,
      );
    }
    return res;
  }
  visitReturnClause(
    node: AST.ReturnClause,
    args: DescentArgs,
  ): LogicalPlanOperator {
    return this.visitProjectionBody(node.body, { ...args, append: false });
  }
  visitLiteral<T>(node: ASTLiteral<T>, args: DescentArgs): LogicalPlanOperator {
    return new plan.Literal('cypher', node.value);
  }
  visitOperator(node: ASTOperator, args: DescentArgs): LogicalPlanOperator {
    return new plan.FnCall(
      node.lang,
      node.operands.map((x) => ({ op: x.accept(this, args) })), // identifiers should be processed into FnCalls, so that we can set pure=true without concerns
      this.db.langMgr.getOp(node.lang, ...idToPair(node.id)).impl,
      true,
    );
  }
  visitFunction(node: ASTFunction, args: DescentArgs): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLangSwitch(node: LangSwitch, args: DescentArgs): LogicalPlanOperator {
    const nested = new (this.db.langMgr.getLang(
      node.lang,
    ).visitors.logicalPlanBuilder)(this.db).buildPlan(node.node, args.ctx);
    for (const item of nested.inferred) {
      args.inferred.add(item);
    }
    if (nested.plan instanceof LogicalPlanTupleOperator) {
      return new plan.MapToItem('cypher', null, nested.plan);
    }
    return nested.plan;
  }
  visitIdentifier(node: ASTIdentifier, args: DescentArgs): LogicalPlanOperator {
    infer(node, args);
    return new plan.FnCall('cypher', [node], ret1);
  }
}
