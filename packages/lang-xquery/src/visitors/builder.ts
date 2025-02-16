import {
  ASTFunction,
  ASTIdentifier,
  ASTLiteral,
  ASTOperator,
  LangSwitch,
  ASTNode,
  LogicalPlanBuilder,
  LogicalPlanOperator,
  LanguageManager,
  CalculationParams,
  LogicalPlanVisitor,
  UnsupportedError,
  LogicalPlanTupleOperator,
  Aliased,
  LogicalOpOrId,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import { XQueryVisitor } from '../ast/visitor.js';
import * as AST from '../ast/index.js';
import { DOT, LEN, POS } from '../utils/dot.js';
import { TreeJoin } from '../plan/tree-join.js';
import { treeStep } from '../utils/tree-step.js';
import { toBool } from '../castables/basic-types.js';
import { ProjectionSize } from '../plan/projection-size.js';
import { collect } from '@dortdb/core/aggregates';
import { resolveArgs, schemaToTrie } from '@dortdb/core/utils';
import { unwind } from '@dortdb/core/fns';
import { ItemSourceResolver } from './item-source-resolver.js';
import { TrieMap } from 'mnemonist';

function ret1<T>(x: T): T {
  return x;
}
function retI0<T>(x: [T, ...any[]]): T {
  return x[0];
}
function retI1<T>(x: [any, T, ...any[]]): T {
  return x[1];
}
function idToPair(id: ASTIdentifier): [string, string] {
  return [
    id.parts[id.parts.length - 1] as string,
    id.parts[id.parts.length - 2] as string,
  ];
}
function toId(id: string | symbol): ASTIdentifier {
  return AST.XQueryIdentifier.fromParts([id]);
}
function toTuples(op: LogicalPlanOperator) {
  return op instanceof LogicalPlanTupleOperator
    ? op
    : new plan.MapFromItem('xquery', DOT, op);
}
function collectArg(name: ASTIdentifier): plan.AggregateCall {
  return new plan.AggregateCall('xquery', [name], collect, name);
}

export class XQueryLogicalPlanBuilder
  implements
    XQueryVisitor<LogicalPlanOperator, LogicalPlanTupleOperator>,
    LogicalPlanBuilder
{
  private calcBuilders: Record<string, LogicalPlanVisitor<CalculationParams>>;
  private resolverMap: Record<string, ItemSourceResolver> = {};

  constructor(private langMgr: LanguageManager) {
    this.calcBuilders = langMgr.getVisitorMap('calculationBuilder');
    this.resolverMap['xquery'] = new ItemSourceResolver(this.resolverMap);
  }

  buildPlan(node: ASTNode): LogicalPlanOperator {
    const res = node.accept(this);
    this.resolverMap['xquery'].resolveItemSources(res);
    return res;
  }

  private toCalc(
    node: ASTNode,
    src: LogicalPlanTupleOperator,
  ): plan.Calculation | ASTIdentifier;
  private toCalc(
    node: ASTNode,
    src: LogicalPlanTupleOperator,
    skipVars: false,
  ): plan.Calculation;
  private toCalc(
    node: ASTNode,
    src: LogicalPlanTupleOperator,
    skipVars = true,
  ): plan.Calculation | ASTIdentifier {
    if (skipVars && node instanceof AST.ASTVariable) return node;
    const calcParams = node.accept(this, src).accept(this.calcBuilders);
    return new plan.Calculation(
      'xquery',
      calcParams.impl,
      calcParams.args,
      calcParams.aggregates,
      calcParams.literal,
    );
  }

  private processNode(
    item: ASTNode,
    src: LogicalPlanTupleOperator,
  ): LogicalOpOrId {
    return item instanceof AST.ASTVariable ? item : item.accept(this, src);
  }
  private processFnArg(
    item: ASTNode,
    src: LogicalPlanTupleOperator,
  ): plan.PlanOpAsArg | ASTIdentifier {
    return item instanceof AST.ASTVariable
      ? item
      : { op: item.accept(this, src) };
  }
  private toCalcParams(node: ASTNode, src: LogicalPlanTupleOperator) {
    return node.accept(this, src).accept(this.calcBuilders);
  }

  visitProlog(
    node: AST.Prolog,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new UnsupportedError('Prolog not supported');
  }
  visitDefaultNSDeclaration(
    node: AST.DefaultNSDeclaration,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitBaseURIDeclaration(
    node: AST.BaseURIDeclaration,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitOrderingDeclaration(
    node: AST.OrderingDeclaration,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitEmptyOrderDeclaration(
    node: AST.EmptyOrderDeclaration,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitNSDeclaration(
    node: AST.NSDeclaration,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitStringLiteral(node: AST.ASTStringLiteral): LogicalPlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  visitNumberLiteral(node: AST.ASTNumberLiteral): LogicalPlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  visitXQueryIdentifier(node: AST.XQueryIdentifier): LogicalPlanOperator {
    return this.visitIdentifier(node);
  }
  visitVariable(
    node: AST.ASTVariable,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    return new plan.ItemSource('xquery', node);
  }
  visitFLWORExpr(node: AST.FLWORExpr): LogicalPlanOperator {
    let res = node.clauses[0].accept(this) as LogicalPlanTupleOperator;
    for (let i = 1; i < node.clauses.length; i++) {
      res = node.clauses[i].accept(this, res) as LogicalPlanTupleOperator;
    }
    return res;
  }

  private maybeProjectConcat(
    op: LogicalPlanTupleOperator,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanTupleOperator {
    if (src) {
      return new plan.ProjectionConcat('xquery', op, false, src);
    }
    return op;
  }
  visitFLWORFor(
    node: AST.FLWORFor,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    let res = this.visitFLWORForBinding(node.bindings[0], src);
    for (let i = 1; i < node.bindings.length; i++) {
      res = this.visitFLWORForBinding(node.bindings[i], res);
    }
    return res;
  }

  visitFLWORForBinding(
    node: AST.FLWORForBinding,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanTupleOperator {
    let res: LogicalPlanTupleOperator = new plan.MapFromItem(
      'xquery',
      node.variable,
      node.expr.accept(this, src),
    );
    if (node.posVar) {
      res = new plan.ProjectionIndex('xquery', node.posVar, res);
    }
    res = this.maybeProjectConcat(res, src);
    if (node.allowEmpty) {
      if (res instanceof plan.ProjectionConcat) res.outer = true;
      else
        res = new plan.ProjectionConcat(
          'xquery',
          res,
          true,
          new plan.NullSource('xquery'),
        );
      if (node.posVar) {
        (res as plan.ProjectionConcat).emptyVal.set(node.posVar.parts, 0);
      }
    }
    return res;
  }
  visitFLWORLet(
    node: AST.FLWORLet,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    let res = src ?? new plan.NullSource('xquery');
    const attrs: Aliased<ASTIdentifier | plan.Calculation>[] = res.schema.map(
      (x) => [x, x] as Aliased,
    );
    for (const [varName, expr] of node.bindings) {
      attrs.push([this.toCalc(expr, src), varName]);
    }
    return new plan.Projection('xquery', attrs, res);
  }
  visitFLWORWindow(
    node: AST.FLWORWindow,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new UnsupportedError('Window clause not supported.');
  }
  visitFLWORWhere(
    node: AST.FLWORWhere,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    return new plan.Selection('xquery', this.toCalc(node.expr, src), src);
  }

  private processGroupByItem(
    item: [AST.ASTVariable, ASTNode],
    src: LogicalPlanTupleOperator,
  ): Aliased<ASTIdentifier | plan.Calculation> {
    return [this.toCalc(item[1], src), item[0]];
  }
  visitFLWORGroupBy(
    node: AST.FLWORGroupBy,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    const keySet = schemaToTrie(node.bindings.map(retI0));
    const keys = node.bindings.map((x) => this.processGroupByItem(x, src));
    return new plan.GroupBy(
      'xquery',
      keys,
      src.schema.filter((x) => !keySet.has(x.parts)).map(collectArg),
      src,
    );
  }

  private processOrderItem(
    item: AST.OrderByItem,
    src: LogicalPlanTupleOperator,
  ): plan.Order {
    return {
      ascending: item.ascending,
      nullsFirst: item.emptyGreatest !== item.ascending,
      key: this.toCalc(item.expr, src),
    };
  }
  visitFLWOROrderBy(
    node: AST.FLWOROrderBy,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    return new plan.OrderBy(
      'xquery',
      node.items.map((x) => this.processOrderItem(x, src)),
      src,
    );
  }
  visitFLWORCount(
    node: AST.FLWORCount,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    return new plan.ProjectionIndex('xquery', node.variable, src);
  }
  visitFLWORReturn(
    node: AST.FLWORReturn,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    if (node.expr instanceof AST.ASTVariable) {
      return new plan.MapToItem('xquery', node.expr, src);
    }
    return new plan.MapToItem(
      'xquery',
      DOT,
      new plan.Projection('xquery', [[this.toCalc(node.expr, src), DOT]], src),
    );
  }
  visitQuantifiedExpr(
    node: AST.QuantifiedExpr,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSwitchExpr(
    node: AST.SwitchExpr,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    return new plan.Conditional(
      'xquery',
      node.expr && this.processNode(node.expr, src),
      node.cases.flatMap(([ws, t]) => {
        const then = this.processNode(t, src);
        return ws.map(
          (w) =>
            [this.processNode(w, src), then] as [LogicalOpOrId, LogicalOpOrId],
        );
      }),
      node.defaultCase && this.processNode(node.defaultCase, src),
    );
  }
  visitIfExpr(
    node: AST.IfExpr,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    return new plan.Conditional(
      'xquery',
      null,
      [
        [
          this.processNode(node.condition, src),
          this.processNode(node.then, src),
        ],
      ],
      node.elseExpr && this.processNode(node.elseExpr, src),
    );
  }
  visitSequenceType(
    node: AST.ASTSequenceType,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitInstanceOfExpr(
    node: AST.InstanceOfExpr,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCastExpr(
    node: AST.CastExpr,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    const impl = this.langMgr.getCast('xquery', ...idToPair(node.type));
    return new plan.FnCall(
      'sql',
      [{ op: node.expr.accept(this, src) }],
      impl.convert,
      impl.pure,
    );
  }
  visitItemType(
    node: AST.ASTItemType,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }

  private processPathStart(
    first: ASTNode,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanTupleOperator {
    if (first instanceof AST.PathAxis) {
      if (!src?.schemaSet.has(DOT.parts)) {
        throw new UnsupportedError('No clear context for path start');
      }
      return this.visitPathAxis(
        first,
        toTuples(new plan.ItemFnSource('xquery', [DOT], unwind.impl)),
      );
    }
    const res = toTuples(first.accept(this, src));
    return res;
  }
  private processPathStep(step: ASTNode, src: LogicalPlanTupleOperator) {
    if (step === DOT) {
      return src;
    }
    if (step instanceof AST.FilterExpr) {
      return this.maybeProjectConcat(this.visitFilterExpr(step, src), src);
    } else if (step instanceof AST.PathAxis) {
      return step.accept(this, src) as LogicalPlanTupleOperator;
    } else {
      const calc = this.toCalc(step, src, false);
      return new TreeJoin('xquery', calc, src);
    }
  }
  visitPathExpr(
    node: AST.PathExpr,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    if (node.start) {
      throw new UnsupportedError('Only relative paths are supported');
    }
    let res = this.processPathStart(node.steps[0], src);
    for (let i = 1; i < node.steps.length; i++) {
      res = this.processPathStep(node.steps[i], res);
    }
    return new plan.MapToItem('xquery', DOT, res);
  }

  visitPathPredicate(
    node: AST.PathPredicate,
    src?: LogicalPlanTupleOperator,
  ): LogicalPlanTupleOperator {
    const calcParams = node.exprs.map((x) => this.toCalcParams(x, src));
    const args = calcParams.flatMap((p) => p.args);
    args.push(POS);
    const calc = new plan.Calculation(
      'xquery',
      (...args) => {
        const pos = args[args.length - 1];
        const res = resolveArgs(args, calcParams).flat();
        return typeof res === 'number' ? res === pos : toBool.convert(res);
      },
      args,
    );
    return new plan.Selection('xquery', calc, src);
  }
  visitPathAxis(
    node: AST.PathAxis,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanTupleOperator {
    let res: LogicalPlanTupleOperator = new TreeJoin(
      'xquery',
      new plan.Calculation('xquery', treeStep(node.nodeTest, node.axis), [DOT]),
      src,
    );
    for (const pred of node.predicates) {
      res = this.visitPathPredicate(pred, res);
    }
    return res;
  }
  visitFilterExpr(
    node: AST.FilterExpr,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanTupleOperator {
    let res = toTuples(node.expr.accept(this, src));
    res = new plan.ProjectionIndex('xquery', POS, res);
    res = new ProjectionSize('xquery', LEN, res);
    return this.visitPathPredicate(node.predicate, res);
  }
  visitDynamicFunctionCall(
    node: AST.DynamicFunctionCall,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    const args = node.args.map((x) => this.processFnArg(x, src));
    args.push({ op: node.nameOrExpr.accept(this, src) });
    return new plan.FnCall('xquery', args, (...as) => as.pop()(...as));
  }
  visitSequenceConstructor(
    node: AST.SequenceConstructor,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    return new plan.FnCall(
      'xquery',
      node.items.map((x) => this.processFnArg(x, src)),
      Array.of,
    );
  }
  visitOrderedExpr(
    node: AST.OrderedExpr,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new UnsupportedError('Ordered expressions not supported');
  }
  visitDirectElementConstructor(
    node: AST.DirectElementConstructor,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitDirConstrContent(
    node: AST.DirConstrContent,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitModule(node: AST.Module): LogicalPlanOperator {
    // TODO: implement prolog
    let res = node.body[0].accept(this);
    for (let i = 1; i < node.body.length; i++) {
      res = new plan.Union('xquery', res, node.body[i].accept(this));
    }
    return res;
  }
  visitDirectPIConstructor(
    node: AST.DirectPIConstructor,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitDirectCommentConstructor(
    node: AST.DirectCommentConstructor,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitComputedConstructor(
    node: AST.ComputedConstructor,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitInlineFn(
    node: AST.InlineFunction,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    throw new UnsupportedError('Inline functions not supported');
  }
  visitBoundFunction(
    node: AST.BoundFunction,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    const args = node.boundArgs
      .map(retI1)
      .map((x) => this.processFnArg(x, src));
    const impl =
      node.nameOrExpr instanceof ASTIdentifier &&
      !(node.nameOrExpr instanceof AST.ASTVariable)
        ? this.langMgr.getFn('xquery', ...idToPair(node.nameOrExpr)).impl
        : null;
    if (!impl) args.push({ op: node.nameOrExpr.accept(this, src) });
    const boundIndices = new Set(node.boundArgs.map(retI0));

    return new plan.FnCall('xquery', args, (...bound) => {
      const fn = impl ?? bound.pop();
      return (...unbound: any[]) => {
        const fullSize = unbound.length + bound.length;
        const allArgs = Array(fullSize);
        let bi = 0;
        let ui = 0;
        for (let i = 0; i < fullSize; i++) {
          allArgs[i] = boundIndices.has(i) ? bound[bi++] : unbound[ui++];
        }
        return fn(...allArgs);
      };
    });
  }
  visitLiteral<U>(node: ASTLiteral<U>): LogicalPlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  private processOpArg(
    item: ASTNode,
    src: LogicalPlanTupleOperator,
  ): plan.PlanOpAsArg {
    return {
      op:
        item instanceof AST.ASTVariable
          ? new plan.FnCall('xquery', [item], ret1)
          : item.accept(this, src),
    };
  }
  visitOperator(
    node: ASTOperator,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    return new plan.FnCall(
      'xquery',
      node.operands.map((x) => this.processOpArg(x, src)),
      this.langMgr.getOp(node.lang, ...idToPair(node.id)).impl,
      true,
    );
  }

  private renameAggSource(
    src: LogicalPlanTupleOperator,
    dot: ASTIdentifier,
    len: ASTIdentifier,
    pos: ASTIdentifier,
  ) {
    if (!src.schemaSet.has(LEN.parts)) {
      src = new ProjectionSize('xquery', LEN, src);
    }
    if (!src.schemaSet.has(POS.parts)) {
      src = new plan.ProjectionIndex('xquery', POS, src);
    }
    return new plan.Projection(
      'xquery',
      [
        [DOT, dot],
        [LEN, len],
        [POS, pos],
      ],
      src,
    );
  }
  private joinAggArgs(args: LogicalPlanTupleOperator[]) {
    const colNames = args.map((_, i) => toId(i + ''));
    const posNames = args.map((_, i) => toId('i' + i));
    const countNames = args.map((_, i) => toId('c' + i));
    let joined: LogicalPlanTupleOperator = this.renameAggSource(
      args[0],
      colNames[0],
      countNames[0],
      posNames[0],
    );
    for (let i = 1; i < args.length; i++) {
      joined = new plan.Join(
        'xquery',
        joined,
        this.renameAggSource(args[i], colNames[i], countNames[i], posNames[i]),
        new plan.Calculation(
          'xquery',
          (i1, i2, c1, c2) => i1 === i2 || c1 === 1 || c2 === 1,
          [posNames[i - 1], posNames[i], countNames[i - 1], countNames[i]],
        ),
      );
      (joined as plan.Join).leftOuter = (joined as plan.Join).rightOuter = true;
    }
    return joined;
  }

  visitFunction(
    node: ASTFunction,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    const [id, schema] = idToPair(node.id);
    const impl = this.langMgr.getFnOrAggr(node.lang, id, schema);

    if ('impl' in impl) {
      return new plan.FnCall(
        node.lang,
        node.args.map((x) => this.processFnArg(x, src)),
        impl.impl,
      );
    }

    const args = node.args.map((x) => toTuples(x.accept(this, src)));
    let gb: plan.GroupBy;
    if (args.length === 1) {
      gb = new plan.GroupBy(
        'xquery',
        [],
        [new plan.AggregateCall('xquery', [DOT], impl, DOT)],
        args[0],
      );
    } else {
      gb = new plan.GroupBy(
        'xquery',
        [],
        [
          new plan.AggregateCall(
            'xquery',
            args.map((_, i) => toId(i + '')),
            impl,
            DOT,
          ),
        ],
        this.joinAggArgs(args),
      );
    }

    return new plan.MapToItem('xquery', DOT, gb);
  }
  visitLangSwitch(
    node: LangSwitch,
    src: LogicalPlanTupleOperator,
  ): LogicalPlanOperator {
    const nested = new (this.langMgr.getLang(
      node.lang,
    ).visitors.logicalPlanBuilder)(this.langMgr).buildPlan(node.node);
    if (nested instanceof LogicalPlanTupleOperator) {
      return new plan.MapToItem('xquery', null, nested);
    }
    return nested;
  }
  visitIdentifier(node: ASTIdentifier): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
}
