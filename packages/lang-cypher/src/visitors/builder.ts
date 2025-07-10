import {
  AggregateFn,
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
  EqualityChecker,
  IdSet,
  LangSwitch,
  LogicalPlanBuilder,
  PlanOperator,
  PlanTupleOperator,
  PlanVisitor,
  toInfer,
  UnsupportedError,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import * as AST from '../ast/index.js';
import { CypherVisitor } from '../ast/visitor.js';
import { ASTDeterministicStringifier } from './ast-stringifier.js';
import { unwind } from '@dortdb/core/fns';
import { CypherDataAdaper, EdgeDirection } from '../language/data-adapter.js';
import {
  AdapterCtxArg,
  CypherFn,
  CypherLanguage,
} from '../language/language.js';
import { Trie } from '@dortdb/core/data-structures';
import { isMatch } from 'lodash-es';
import {
  createMapLiteral,
  propLookup,
  ret1,
  retI0,
  toPair,
} from '@dortdb/core/internal-fns';
import {
  assertCalcLiteral,
  exprToSelection,
  getAggregates,
  intermediateToCalc,
  schemaToTrie,
  union,
} from '@dortdb/core/utils';
import { collect } from '@dortdb/core/aggregates';
import { eq } from '@dortdb/core/operators';

function idToPair(id: ASTIdentifier): [string, string] {
  return [id.parts.at(-1) as string, id.parts.at(-2) as string];
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
function getUnd(): undefined {
  return undefined;
}
function firstPart(id: ASTIdentifier): string | symbol | number {
  return id.parts[0];
}

interface DescentArgs {
  src?: PlanTupleOperator;
  ctx: IdSet;
  inferred: IdSet;
  graphName: ASTIdentifier;
}

export class CypherLogicalPlanBuilder
  implements LogicalPlanBuilder, CypherVisitor<PlanOperator, DescentArgs>
{
  protected calcBuilders: Record<string, PlanVisitor<CalculationParams>>;
  protected eqCheckers: Record<string, EqualityChecker>;
  protected stringifier = new ASTDeterministicStringifier();
  protected dataAdapter: CypherDataAdaper;

  constructor(protected db: DortDBAsFriend) {
    this.calcBuilders = db.langMgr.getVisitorMap('calculationBuilder');
    this.eqCheckers = db.langMgr.getVisitorMap('equalityChecker');
    const lang = db.langMgr.getLang<'cypher', CypherLanguage>('cypher');
    this.dataAdapter = lang.dataAdapter;
  }

  protected maybeId(node: ASTNode, args: DescentArgs): ASTNode {
    if (!(node instanceof AST.PropLookup)) return node;
    const parts = [node.prop.parts[0]];
    let root = node.expr;
    while (root instanceof AST.PropLookup) {
      parts.push(root.prop.parts[0]);
      root = root.expr;
    }
    if (
      root instanceof ASTIdentifier &&
      root.parts[0] !== boundParam &&
      !args.ctx.has(root.parts)
    ) {
      parts.push(root.parts[0]);
      parts.reverse();
      return ASTIdentifier.fromParts(parts);
    }
    return node;
  }

  protected toCalc(
    node: ASTNode,
    args: DescentArgs,
  ): plan.Calculation | ASTIdentifier {
    node = this.maybeId(node, args);
    if (node instanceof ASTIdentifier) return infer(node, args);
    const intermediate = node.accept(this, args);
    if (intermediate instanceof plan.AggregateCall) {
      return intermediate.fieldName;
    }
    return intermediateToCalc(intermediate, this.calcBuilders, this.eqCheckers);
  }
  protected processFnArg(
    item: ASTNode,
    args: DescentArgs,
  ): plan.PlanOpAsArg | ASTIdentifier {
    item = this.maybeId(item, args);
    return item instanceof ASTIdentifier
      ? infer(item, args)
      : { op: item.accept(this, args) };
  }
  protected processAttr(
    attr: ASTNode | Aliased<ASTNode>,
    args: DescentArgs,
  ): Aliased<ASTIdentifier | plan.Calculation> {
    if (Array.isArray(attr)) {
      attr[0] = this.maybeId(attr[0], args);
    } else {
      attr = this.maybeId(attr, args);
    }
    if (attr instanceof ASTIdentifier) {
      return [infer(attr, args), attr];
    }
    if (Array.isArray(attr)) {
      return [this.toCalc(attr[0], args), attr[1]];
    }
    const alias = toId(attr.accept(this.stringifier));
    return [this.toCalc(attr, args), alias];
  }
  protected processNode(node: ASTNode, args: DescentArgs) {
    node = this.maybeId(node, args);
    return node instanceof ASTIdentifier
      ? infer(node, args)
      : node.accept(this, args);
  }

  buildPlan(node: ASTNode, ctx: IdSet) {
    const inferred = new Trie<string | symbol>();
    return {
      plan: node.accept(this, {
        ctx,
        inferred,
        graphName: this.db.langMgr.getLang<'cypher', CypherLanguage>('cypher')
          .defaultGraph,
      }),
      inferred,
    };
  }
  visitCypherIdentifier(
    node: AST.CypherIdentifier,
    args: DescentArgs,
  ): PlanOperator {
    return this.visitIdentifier(node, args);
  }
  visitStringLiteral(node: AST.ASTStringLiteral): PlanOperator {
    return new plan.Literal('cypher', node.value);
  }
  visitNumberLiteral(node: AST.ASTNumberLiteral): PlanOperator {
    return new plan.Literal('cypher', node.value);
  }
  visitListLiteral(node: AST.ASTListLiteral, args: DescentArgs): PlanOperator {
    return new plan.FnCall(
      'cypher',
      node.items.map((item) => this.processFnArg(item, args)),
      Array.of,
    );
  }
  visitMapLiteral(node: AST.ASTMapLiteral, args: DescentArgs): PlanOperator {
    const names = node.items.map((i) => i[1].parts[0]);
    const values = node.items.map((i) => this.processFnArg(i[0], args));
    values.unshift({ op: new plan.Literal('cypher', names) });
    return new plan.FnCall('cypher', values, createMapLiteral);
  }
  visitBooleanLiteral(node: AST.ASTBooleanLiteral): PlanOperator {
    return new plan.Literal('cypher', node.value);
  }
  visitFnCallWrapper(node: AST.FnCallWrapper, args: DescentArgs): PlanOperator {
    if (node.procedure) return this.visitProcedure(node, args);
    const [id, schema] = idToPair(node.fn.id);
    let impl: CypherFn | AggregateFn;
    try {
      impl = this.db.langMgr.getFnOrAggr('cypher', id, schema);
    } catch (e) {
      const cast = this.db.langMgr.getCast('cypher', id, schema);
      if (cast) {
        impl = {
          name: cast.name,
          impl: cast.convert,
          pure: cast.pure,
        };
      } else {
        throw e;
      }
    }

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

    const fnArgs = node.fn.args.map((arg) => this.processFnArg(arg, args));
    if (impl.addAdapterCtx) {
      const graph = this.db.getSource(args.graphName.parts);
      fnArgs.unshift({
        op: new plan.Literal('cypher', {
          adapter: this.dataAdapter,
          graph,
        } as AdapterCtxArg),
      });
    }
    return new plan.FnCall('cypher', fnArgs, impl.impl, impl.pure);
  }

  protected visitProcedure(
    node: AST.FnCallWrapper,
    args: DescentArgs,
  ): PlanOperator {
    const [id, schema] = idToPair(node.fn.id);
    const impl = this.db.langMgr.getFn('cypher', id, schema) as CypherFn;
    const fnArgs = node.fn.args.map((arg) => this.toCalc(arg, args));
    if (impl.addAdapterCtx) {
      const graph = this.db.getSource(args.graphName.parts);
      const ctx: AdapterCtxArg = {
        adapter: this.dataAdapter,
        graph,
      };
      fnArgs.unshift(
        new plan.Calculation(
          'cypher',
          () => ctx,
          [],
          [],
          new plan.Literal('cypher', ctx),
        ),
      );
    }
    let res: PlanTupleOperator = new plan.TupleFnSource(
      'cypher',
      fnArgs,
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
      res = exprToSelection(
        this.processNode(node.where, args),
        res,
        this.calcBuilders,
        this.eqCheckers,
        'cypher',
      );
    }
    return res;
  }

  visitExistsSubquery(
    node: AST.ExistsSubquery,
    args: DescentArgs,
  ): PlanOperator {
    let res = node.query.accept(this, args) as PlanOperator;
    if (!(res instanceof PlanTupleOperator)) {
      res = new plan.MapFromItem('cypher', toId('exists'), res);
    }
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
  ): PlanOperator {
    let res: PlanTupleOperator = new plan.MapFromItem(
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
        cond = new plan.Calculation('cypher', (x) => !x, [cond], [undefined]);
      } else {
        const oldImpl = cond.impl;
        cond.impl = (...args) => !oldImpl(...args);
      }
    }
    res = new plan.Selection('cypher', cond, res);
    res = new plan.Limit('cypher', 0, 1, res);
    res = new plan.Projection(
      'cypher',
      [
        [
          new plan.Calculation('cypher', () => invertRes, [], []),
          node.variable,
        ],
      ],
      res,
    );
    return res;
  }

  protected preparePatternRefs(
    refVars: ASTIdentifier[],
    chain: (AST.NodePattern | AST.RelPattern)[],
    isRef: boolean[],
    args: DescentArgs,
  ): PlanTupleOperator {
    if (refVars.length) {
      let res: PlanTupleOperator =
        args.src ??
        new plan.Projection(
          'cypher',
          refVars.map(toPair),
          new plan.NullSource('cypher'),
        );
      for (let i = 0, j = 0; i < chain.length; i++) {
        if (isRef[i]) {
          res = this.patternToSelection(res, refVars[j++], chain[i], args);
        }
      }
      return res;
    }
    return args.src;
  }
  protected patternToSelection(
    src: PlanTupleOperator,
    variable: ASTIdentifier,
    el: AST.NodePattern | AST.RelPattern,
    args: DescentArgs,
  ) {
    if (!el.props) return src;

    if (el.props instanceof ASTIdentifier) {
      const fn = new plan.FnCall(
        'cypher',
        [variable, this.processFnArg(el.props, args)],
        isMatch,
      );
      const calc = intermediateToCalc(fn, this.calcBuilders, this.eqCheckers);
      return new plan.Selection('cypher', calc, src);
    }

    for (const prop of el.props.items) {
      const fn = new plan.FnCall(
        'cypher',
        [
          {
            op: new plan.FnCall(
              'cypher',
              [
                variable,
                { op: new plan.Literal('cypher', [prop[1].parts[0]]) },
              ],
              propLookup,
              true,
            ),
          },
          this.processFnArg(prop[0], args),
        ],
        eq.impl,
      );
      const calc = intermediateToCalc(fn, this.calcBuilders, this.eqCheckers);
      src = new plan.Selection('cypher', calc, src);
    }
    return src;
  }

  protected setupChainSelections(
    chain: (AST.NodePattern | AST.RelPattern)[],
    variables: ASTIdentifier[],
    res: PlanTupleOperator,
    graphName: ASTIdentifier,
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
        graphName,
      );
      res = this.isEdgeConnected(
        res,
        edgeDir2,
        variables[i + 1],
        variables[i],
        false,
        graphName,
      );
    }

    const edgeVars = variables.filter((_, i) => i % 2 === 1);
    for (let i = 1; i < chain.length; i += 2) {
      const args = edgeVars.slice(0, i / 2 + 1);
      const edge = chain[i] as AST.RelPattern;
      const recursive = !!edge.range;

      if (
        recursive &&
        !edge.pointsLeft &&
        !edge.pointsRight &&
        edge.range[1]?.value !== 1
      ) {
        res = this.checkCorrectAnyRecursion(variables, graphName, i, res);
      }
      if (i === 1) continue;

      const fn = new plan.FnCall('cypher', args, (...args) => {
        const last = args.pop();
        if (recursive) {
          return args.every((arg, j) =>
            (chain[j * 2 + 1] as AST.RelPattern).range
              ? arg.every((e: unknown) => !last.includes(e))
              : !last.includes(arg),
          );
        }
        return args.every((arg, j) =>
          (chain[j * 2 + 1] as AST.RelPattern).range
            ? !arg.includes(last)
            : arg !== last,
        );
      });
      res = new plan.Selection(
        'cypher',
        intermediateToCalc(fn, this.calcBuilders, this.eqCheckers),
        res,
      );
    }
    return res;
  }

  protected checkCorrectAnyRecursion(
    variables: ASTIdentifier[],
    graphName: ASTIdentifier,
    i: number,
    source: PlanTupleOperator,
  ): PlanTupleOperator {
    const graph = this.db.getSource(graphName.parts);
    const nodeCheckFn = new plan.FnCall(
      'cypher',
      [variables[i - 1], variables[i], variables[i + 1]],
      (n1, e: unknown[], n2) => {
        if (e.length < 2) return true;
        const e0Src = this.dataAdapter.getEdgeNode(graph, e[0], 'source');
        if (
          e0Src !== n1 &&
          !this.dataAdapter.isConnected(graph, e0Src, e[1], 'any')
        )
          return false;
        const e0Tgt = this.dataAdapter.getEdgeNode(graph, e[0], 'target');
        if (
          e0Tgt !== n1 &&
          !this.dataAdapter.isConnected(graph, e0Tgt, e[1], 'any')
        )
          return false;
        const eLSrc = this.dataAdapter.getEdgeNode(graph, e.at(-1), 'source');
        if (
          eLSrc !== n2 &&
          !this.dataAdapter.isConnected(graph, eLSrc, e[1], 'any')
        )
          return false;
        const eLTgt = this.dataAdapter.getEdgeNode(graph, e.at(-1), 'target');
        if (
          eLTgt !== n2 &&
          !this.dataAdapter.isConnected(graph, eLTgt, e[1], 'any')
        )
          return false;
        return true;
      },
    );
    return new plan.Selection(
      'cypher',
      intermediateToCalc(nodeCheckFn, this.calcBuilders, this.eqCheckers),
      source,
    );
  }

  protected isEdgeConnected(
    res: PlanTupleOperator,
    dir: EdgeDirection,
    node: ASTIdentifier,
    edge: ASTIdentifier,
    /** if edge resolves to an array (e.g. for recursive edge), pick first or last item? */
    pickFirstEdge: boolean,
    graphName: ASTIdentifier,
  ) {
    const graph = this.db.getSource(graphName.parts);
    const fnCall = new plan.FnCall(
      'cypher',
      [
        { op: new plan.Literal('cypher', graph) },
        node,
        {
          op: new plan.FnCall(
            'cypher',
            [edge],
            (e) => (Array.isArray(e) ? (pickFirstEdge ? e[0] : e.at(-1)) : e),
            true,
          ),
        },
        { op: new plan.Literal('cypher', dir) },
      ],
      this.dataAdapter.isConnected,
    );
    return new plan.Selection(
      'cypher',
      intermediateToCalc(fnCall, this.calcBuilders, this.eqCheckers),
      res,
    );
  }

  visitPatternElChain(
    node: AST.PatternElChain,
    args: DescentArgs & { optional?: boolean },
  ): PlanTupleOperator {
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
        item.variable.parts.at(-1) === toInfer
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
        src: args.optional ? null : args.src,
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
        }) as PlanTupleOperator;
        firstUnknown++;
      }
      for (let i = firstUnknown; i < node.chain.length; i++) {
        if (isRef[i]) continue;
        const nextPart = node.chain[i].accept(this, {
          ...args,
          variable: variables[i],
          prevPart: variables[i - 1],
          ctx,
        } as DescentArgs & {
          variable: ASTIdentifier;
        }) as PlanTupleOperator;
        res = new plan.ProjectionConcat('cypher', nextPart, false, res);
      }
    }

    res = this.setupChainSelections(node.chain, variables, res, args.graphName);
    const cols = res.schema
      .filter((x) => x.parts[0] !== varPrefix)
      .map((col) => [col, col]) as Aliased<ASTIdentifier | plan.Calculation>[];
    if (!node.variable && cols.length === res.schema.length) return res;
    if (node.variable) {
      cols.push([
        new plan.Calculation(
          'cypher',
          (...args) => args,
          variables,
          variables.map(getUnd),
        ),
        node.variable,
      ]);
    }
    res = new plan.Projection('cypher', cols, res);
    if (args.optional) {
      const src = args.src ?? new plan.NullSource('cypher');
      res = new plan.ProjectionConcat('cypher', res, true, src);
    }

    return res;
  }
  visitNodePattern(
    node: AST.NodePattern,
    args: DescentArgs & { variable: ASTIdentifier },
  ): PlanTupleOperator {
    const graphName = args.graphName.parts;
    const graph = this.db.getSource(graphName);
    const src = new plan.ItemSource(
      'cypher',
      ASTIdentifier.fromParts(graphName.concat('nodes')),
    );
    let res: PlanTupleOperator = new plan.MapFromItem(
      'cypher',
      args.variable,
      src,
    );
    if (node.labels.length) {
      const fncall = new plan.FnCall(
        'cypher',
        [
          { op: new plan.Literal('cypher', graph) },
          args.variable,
          {
            op: new plan.Literal('cypher', node.labels.map(firstPart)),
          },
        ],
        this.dataAdapter.hasLabels,
      );
      res = new plan.Selection(
        'cypher',
        intermediateToCalc(fncall, this.calcBuilders, this.eqCheckers),
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
    args: DescentArgs & { variable: ASTIdentifier; prevPart: ASTIdentifier },
  ): PlanTupleOperator {
    const graphName = args.graphName.parts;
    const graph = this.db.getSource(graphName);
    const src = new plan.ItemSource(
      'cypher',
      ASTIdentifier.fromParts(graphName.concat('edges')),
    );
    let res: PlanTupleOperator = new plan.MapFromItem(
      'cypher',
      args.variable,
      src,
    );
    if (node.types.length) {
      const fncall = new plan.FnCall(
        'cypher',
        [
          { op: new plan.Literal('cypher', graph) },
          args.variable,
          {
            op: new plan.Literal('cypher', node.types.map(firstPart)),
          },
        ],
        this.dataAdapter.hasAnyType,
      );
      res = new plan.Selection(
        'cypher',
        intermediateToCalc(fncall, this.calcBuilders, this.eqCheckers),
        res,
      );
    }
    if (node.props) {
      res = this.patternToSelection(res, args.variable, node, args);
    }
    if (node.range) {
      res = this.addRecursion(node, res, args);
    }
    return res;
  }

  protected addRecursion(
    edge: AST.RelPattern,
    source: PlanTupleOperator,
    args: DescentArgs & { variable: ASTIdentifier },
  ) {
    const min = edge.range[0]?.value ?? 1;
    const max = edge.range[1]?.value ?? Infinity;
    const graph = this.db.getSource(args.graphName.parts);
    const edgeDir: EdgeDirection = edge.pointsLeft
      ? 'in'
      : edge.pointsRight
        ? 'out'
        : 'any';

    const mapping = this.createRecursionMapping(
      args.variable,
      graph,
      edgeDir,
      source.clone(),
    );

    return new plan.IndexedRecursion('cypher', min, max, mapping, source);
  }
  protected createRecursionMapping(
    edgeVar: ASTIdentifier,
    graph: unknown,
    edgeDir: EdgeDirection,
    mapping: PlanTupleOperator,
  ): PlanTupleOperator {
    const mappingSrc = new plan.ItemFnSource(
      'cypher',
      [edgeVar],
      (edges: unknown[]) => {
        const nodes: unknown[] = [];
        if (edgeDir === 'any') {
          const srcNode = this.dataAdapter.getEdgeNode(
            graph,
            edges.at(-1),
            'source',
          );
          const tgtNode = this.dataAdapter.getEdgeNode(
            graph,
            edges.at(-1),
            'target',
          );
          if (edges.length === 1) {
            nodes.push(srcNode, tgtNode);
          } else {
            if (
              this.dataAdapter.isConnected(graph, srcNode, edges.at(-2), 'any')
            ) {
              nodes.push(tgtNode);
            } else {
              nodes.push(srcNode);
            }
          }
        } else if (edgeDir === 'in') {
          nodes.push(
            this.dataAdapter.getEdgeNode(graph, edges.at(-1), 'source'),
          );
        } else {
          nodes.push(
            this.dataAdapter.getEdgeNode(graph, edges.at(-1), 'target'),
          );
        }
        return Iterator.from(nodes).flatMap((n) =>
          this.dataAdapter.filterNodeEdges(
            graph,
            n,
            edgeDir,
            (src, tgt, e) => !edges.includes(e),
          ),
        );
      },
      toId('connectedEdges'),
    );
    let oldMappingSrc: any = (mapping as any).source;
    while (!(oldMappingSrc instanceof plan.ItemSource)) {
      oldMappingSrc = oldMappingSrc.source;
    }
    oldMappingSrc.parent.replaceChild(oldMappingSrc, mappingSrc);
    return mapping;
  }

  visitPatternComprehension(
    node: AST.PatternComprehension,
    args: DescentArgs,
  ): PlanOperator {
    let op = node.pattern.accept(this, {
      ...args,
      src: undefined,
    }) as PlanTupleOperator;
    const variable = toId('pattern');

    if (node.where) {
      op = exprToSelection(
        this.processNode(node.where, {
          ...args,
          ctx: union(args.ctx, op.schema),
        }),
        op as PlanTupleOperator,
        this.calcBuilders,
        this.eqCheckers,
        'cypher',
      );
    }
    op = new plan.Projection(
      'cypher',
      [
        [
          this.toCalc(node.expr, {
            ...args,
            ctx: union(args.ctx, op.schema),
          }),
          variable,
        ],
      ],
      op,
    );
    const collectAgg = new plan.AggregateCall(
      'cypher',
      [variable],
      collect,
      variable,
    );
    op = new plan.GroupBy('cypher', [], [collectAgg], op);
    return new plan.MapToItem('cypher', variable, op);
  }
  visitListComprehension(
    node: AST.ListComprehension,
    args: DescentArgs,
  ): PlanOperator {
    let op = new plan.MapFromItem(
      'cypher',
      node.variable,
      new plan.ItemFnSource(
        'cypher',
        [this.toCalc(node.source, args)],
        unwind.impl,
        toId('unwind'),
      ),
    ) as PlanTupleOperator;

    if (node.where) {
      op = exprToSelection(
        this.processNode(node.where, {
          ...args,
          ctx: union(args.ctx, [node.variable]),
        }),
        op,
        this.calcBuilders,
        this.eqCheckers,
        'cypher',
      );
    }
    if (node.expr) {
      op = new plan.Projection(
        'cypher',
        [
          [
            this.toCalc(node.expr, {
              ...args,
              ctx: union(args.ctx, [node.variable]),
            }),
            node.variable,
          ],
        ],
        op,
      );
    }
    op = new plan.GroupBy(
      'cypher',
      [],
      [
        new plan.AggregateCall(
          'cypher',
          [node.variable],
          collect,
          node.variable,
        ),
      ],
      op,
    );
    return new plan.MapToItem('cypher', node.variable, op);
  }
  visitCaseExpr(node: AST.CaseExpr, args: DescentArgs): PlanOperator {
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
  visitCountAll(node: AST.CountAll, args: DescentArgs): PlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLabelFilterExpr(
    node: AST.LabelFilterExpr,
    args: DescentArgs,
  ): PlanOperator {
    const graph = this.db.getSource(args.graphName.parts);
    return new plan.FnCall(
      'cypher',
      [
        { op: new plan.Literal('cypher', graph) },
        this.processFnArg(node.expr, args),
        {
          op: new plan.Literal('cypher', node.labels.map(firstPart)),
        },
      ],
      this.dataAdapter.hasLabels,
    );
  }
  visitSubscriptExpr(node: AST.SubscriptExpr, args: DescentArgs): PlanOperator {
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
  visitPropLookup(node: AST.PropLookup, args: DescentArgs): PlanOperator {
    return new plan.FnCall(
      'cypher',
      [
        this.processFnArg(node.expr, args),
        { op: new plan.Literal('cypher', node.prop.parts) },
      ],
      propLookup,
    );
  }
  visitSetOp(node: AST.SetOp, args: DescentArgs): PlanTupleOperator {
    let next = node.next.accept(this, args) as PlanTupleOperator;
    next = new plan.Union('cypher', args.src, next);
    if (node.type === AST.SetOpType.UNIONALL) {
      next = new plan.Distinct('cypher', allAttrs, next);
    }
    return next;
  }
  visitQuery(node: AST.Query, args: DescentArgs): PlanTupleOperator {
    if (node.from) {
      args = { ...args, graphName: node.from };
    } else if (!args.graphName) {
      throw new Error('No graph specified');
    }
    let res = node.statements[0].accept(this, args) as PlanTupleOperator;
    for (let i = 1; i < node.statements.length; i++) {
      res = node.statements[i].accept(this, {
        ...args,
        src: res,
      }) as PlanTupleOperator;
    }
    if (node.setOp) {
      res = this.visitSetOp(node.setOp, { ...args, src: res });
    }
    return res;
  }
  visitMatchClause(node: AST.MatchClause, args: DescentArgs): PlanOperator {
    let res = this.visitPatternElChain(node.pattern[0], {
      ...args,
      optional: node.optional,
    });
    for (let i = 1; i < node.pattern.length; i++) {
      res = this.visitPatternElChain(node.pattern[i], {
        ...args,
        src: res,
        optional: node.optional,
      });
    }
    if (node.where) {
      res = exprToSelection(
        this.processNode(node.where, {
          ...args,
          ctx: union(args.ctx, res.schema),
        }),
        res,
        this.calcBuilders,
        this.eqCheckers,
        'cypher',
      );
    }
    return res;
  }
  visitUnwindClause(node: AST.UnwindClause, args: DescentArgs): PlanOperator {
    let expr = this.processNode(node.expr, {
      ...args,
      ctx: union(args.ctx, args.src?.schema ?? []),
    });
    if (plan.CalcIntermediate in expr) {
      expr = intermediateToCalc(
        expr as PlanOperator,
        this.calcBuilders,
        this.eqCheckers,
      );
    }
    let unwound: PlanOperator;
    if (expr instanceof ASTIdentifier || expr instanceof plan.Calculation) {
      unwound = new plan.ItemFnSource(
        'cypher',
        [expr],
        unwind.impl,
        toId('unwind'),
      );
    } else if (expr instanceof PlanTupleOperator) {
      unwound = new plan.MapToItem(
        'cypher',
        ASTIdentifier.fromParts([allAttrs]),
        expr,
      );
    } else {
      unwound = expr;
    }

    const renamed = new plan.MapFromItem('cypher', node.variable, unwound);
    if (!args.src) return renamed;
    return new plan.ProjectionConcat('cypher', renamed, false, args.src);
  }
  visitCreateClause(node: AST.CreateClause, args: DescentArgs): PlanOperator {
    throw new UnsupportedError('Only read operations are supported');
  }
  visitMergeClause(node: AST.MergeClause, args: DescentArgs): PlanOperator {
    throw new UnsupportedError('Only read operations are supported');
  }
  visitSetClause(node: AST.SetClause, args: DescentArgs): PlanOperator {
    throw new UnsupportedError('Only read operations are supported');
  }
  visitSetItem(node: AST.SetItem, args: DescentArgs): PlanOperator {
    throw new Error('Method not implemented.');
  }
  visitRemoveClause(node: AST.RemoveClause, args: DescentArgs): PlanOperator {
    throw new UnsupportedError('Only read operations are supported');
  }
  visitRemoveItem(node: AST.RemoveItem, args: DescentArgs): PlanOperator {
    throw new Error('Method not implemented.');
  }
  visitDeleteClause(node: AST.DeleteClause, args: DescentArgs): PlanOperator {
    throw new UnsupportedError('Only read operations are supported');
  }
  visitProjectionBody(
    node: AST.ProjectionBody,
    args: DescentArgs & { append: boolean },
  ): PlanTupleOperator {
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
      const aggrs = getAggregates(cols.map(retI0));
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
  protected processOrderBy(
    node: AST.ProjectionBody,
    res: PlanTupleOperator,
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
    const aggrs = getAggregates(preSortCols.map(retI0));
    if (aggrs.length) {
      res = this.processGroupBy(res, aggrs, preSortCols);
    } else {
      res = new plan.Projection('cypher', preSortCols, res);
    }
    return new plan.OrderBy('cypher', orders, res);
  }
  protected processGroupBy(
    res: PlanTupleOperator,
    aggrs: plan.AggregateCall[],
    allCols: Aliased<plan.Calculation | ASTIdentifier>[],
  ): PlanTupleOperator {
    const aggrSet = schemaToTrie(aggrs.map((x) => x.fieldName));
    const groupByCols: Aliased<plan.Calculation | ASTIdentifier>[] = [];
    for (const col of allCols) {
      if (col[0] instanceof ASTIdentifier) {
        if (!aggrSet.has(col[0].parts)) {
          groupByCols.push(col);
        }
      } else {
        if (!col[0].aggregates.length) {
          groupByCols.push([col[0].clone(), col[1]]);
        }
      }
    }
    for (const aggr of aggrs) {
      aggr.postGroupSource.addToSchema(res.schema);
    }

    return new plan.GroupBy('cypher', groupByCols, aggrs, res);
  }
  protected buildLimit(
    node: AST.ProjectionBody,
    res: PlanTupleOperator,
    args: DescentArgs,
  ) {
    const limit = node.limit && this.toCalc(node.limit, args);
    const offset = node.skip && this.toCalc(node.skip, args);
    if (limit && !assertCalcLiteral(limit, 'number'))
      throw new Error('Limit must be a number constant');
    if (offset && !assertCalcLiteral(offset, 'number'))
      throw new Error('Offset must be a number constant');
    return new plan.Limit(
      'cypher',
      offset ? (offset as plan.Calculation).impl() : 0,
      limit ? (limit as plan.Calculation).impl() : Infinity,
      res,
    );
  }

  visitOrderItem(node: AST.OrderItem, args: DescentArgs): PlanOperator {
    throw new Error('Method not implemented.');
  }
  visitWithClause(node: AST.WithClause, args: DescentArgs): PlanOperator {
    let res = this.visitProjectionBody(node.body, { ...args, append: false });
    if (node.where) {
      res = exprToSelection(
        this.processNode(node.where, {
          ...args,
          ctx: union(args.ctx, res.schemaSet),
        }),
        res,
        this.calcBuilders,
        this.eqCheckers,
        'cypher',
      );
    }
    return res;
  }
  visitReturnClause(node: AST.ReturnClause, args: DescentArgs): PlanOperator {
    return this.visitProjectionBody(node.body, { ...args, append: false });
  }
  visitLiteral<T>(node: ASTLiteral<T>, args: DescentArgs): PlanOperator {
    return new plan.Literal('cypher', node.value);
  }
  visitOperator(node: ASTOperator, args: DescentArgs): PlanOperator {
    return new plan.FnCall(
      node.lang,
      node.operands.map((x) => ({ op: x.accept(this, args) })), // identifiers should be processed into FnCalls, so that we can set pure=true without concerns
      this.db.langMgr.getOp(node.lang, ...idToPair(node.id)).impl,
      true,
    );
  }
  visitFunction(node: ASTFunction, args: DescentArgs): PlanOperator {
    throw new Error('Method not implemented.');
  }
  visitLangSwitch(node: LangSwitch, args: DescentArgs): PlanOperator {
    const nested = new (this.db.langMgr.getLang(
      node.lang,
    ).visitors.logicalPlanBuilder)(this.db).buildPlan(node.node, args.ctx);
    for (const item of nested.inferred) {
      args.inferred.add(item);
    }
    if (nested.plan instanceof PlanTupleOperator) {
      return new plan.MapToItem('cypher', null, nested.plan);
    }
    return nested.plan;
  }
  visitIdentifier(node: ASTIdentifier, args: DescentArgs): PlanOperator {
    infer(node, args);
    return new plan.FnCall('cypher', [node], ret1);
  }
}
