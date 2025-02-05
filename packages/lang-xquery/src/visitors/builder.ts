import {
  ASTFunction,
  ASTIdentifier,
  ASTLiteral,
  ASTOperator,
  LangSwitch,
  ASTNode,
  LogicalPlanBuilder,
  LogicalPlanOperator,
  operators,
  LanguageManager,
  CalculationParams,
  LogicalPlanVisitor,
  UnsupportedError,
  LogicalPlanTupleOperator,
  Aliased,
  LogicalOpOrId,
  utils,
  aggregates,
  allAttrs,
} from '@dortdb/core';
import { XQueryVisitor } from '../ast/visitor.js';
import * as AST from '../ast/index.js';
import { DOT, LEN, POS } from '../utils/dot.js';
import { TreeJoin } from '../plan/tree-join.js';
import { treeStep } from '../utils/tree-step.js';
import { toBool } from '../castables/basic-types.js';
import { ProjectionSize } from '../plan/projection-size.js';

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
    : new operators.MapFromItem('xquery', DOT, op);
}
function collectArg(name: ASTIdentifier): operators.AggregateCall {
  return new operators.AggregateCall(
    'xquery',
    [name],
    aggregates.collect,
    name
  );
}

export class XQueryLogicalPlanBuilder
  implements XQueryVisitor<LogicalPlanOperator>, LogicalPlanBuilder
{
  private calcBuilders: Record<string, LogicalPlanVisitor<CalculationParams>>;
  private operatorStack: LogicalPlanTupleOperator[] = [];

  constructor(private langMgr: LanguageManager) {
    this.calcBuilders = langMgr.getVisitorMap('calculationBuilder');

    this.toCalc = this.toCalc.bind(this);
    this.processNode = this.processNode.bind(this);
    this.acceptThis = this.acceptThis.bind(this);
    this.toCalcParams = this.toCalcParams.bind(this);
    this.processOrderItem = this.processOrderItem.bind(this);
    this.processGroupByItem = this.processGroupByItem.bind(this);
  }

  buildPlan(node: ASTNode): LogicalPlanOperator {
    return node.accept(this);
  }

  private toCalc(node: ASTNode): operators.Calculation | ASTIdentifier;
  private toCalc(node: ASTNode, skipVars: false): operators.Calculation;
  private toCalc(
    node: ASTNode,
    skipVars = true
  ): operators.Calculation | ASTIdentifier {
    if (skipVars && node instanceof AST.ASTVariable) return node;
    const calcParams = node.accept(this).accept(this.calcBuilders);
    return new operators.Calculation(
      'xquery',
      calcParams.impl,
      calcParams.args,
      calcParams.aggregates,
      calcParams.literal
    );
  }

  private processNode(item: ASTNode): LogicalOpOrId {
    return item instanceof AST.ASTVariable ? item : item.accept(this);
  }
  private acceptThis(item: ASTNode): LogicalPlanOperator {
    return item.accept(this);
  }
  private toCalcParams(node: ASTNode) {
    return node.accept(this).accept(this.calcBuilders);
  }

  visitProlog(node: AST.Prolog): LogicalPlanOperator {
    throw new UnsupportedError('Prolog not supported');
  }
  visitDefaultNSDeclaration(
    node: AST.DefaultNSDeclaration
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitBaseURIDeclaration(node: AST.BaseURIDeclaration): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitOrderingDeclaration(node: AST.OrderingDeclaration): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitEmptyOrderDeclaration(
    node: AST.EmptyOrderDeclaration
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitNSDeclaration(node: AST.NSDeclaration): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitStringLiteral(node: AST.ASTStringLiteral): LogicalPlanOperator {
    return new operators.Literal('xquery', node.value);
  }
  visitNumberLiteral(node: AST.ASTNumberLiteral): LogicalPlanOperator {
    return new operators.Literal('xquery', node.value);
  }
  visitXQueryIdentifier(node: AST.XQueryIdentifier): LogicalPlanOperator {
    return this.visitIdentifier(node);
  }
  visitVariable(node: AST.ASTVariable): LogicalPlanOperator {
    return new operators.FnCall('xquery', [node], ret1, true);
  }
  visitFLWORExpr(node: AST.FLWORExpr): LogicalPlanOperator {
    let res = node.clauses[0].accept(this) as LogicalPlanTupleOperator;
    for (let i = 1; i < node.clauses.length; i++) {
      this.operatorStack.push(res);
      res = node.clauses[i].accept(this) as LogicalPlanTupleOperator;
    }
    return res;
  }

  private maybeProjectConcat(
    op: LogicalPlanTupleOperator
  ): LogicalPlanTupleOperator {
    if (this.operatorStack.length) {
      return new operators.ProjectionConcat(
        'xquery',
        op,
        false,
        this.operatorStack.pop()
      );
    }
    return op;
  }
  visitFLWORFor(node: AST.FLWORFor): LogicalPlanOperator {
    let res = this.visitFLWORForBinding(node.bindings[0]);
    for (let i = 1; i < node.bindings.length; i++) {
      this.operatorStack.push(res);
      res = this.visitFLWORForBinding(node.bindings[i]);
    }
    return res;
  }

  private getItemSource(node: ASTNode): LogicalPlanOperator {
    if (node instanceof AST.ASTVariable) {
      return new operators.ItemSource('xquery', node);
    }
    return node.accept(this);
  }
  visitFLWORForBinding(node: AST.FLWORForBinding): LogicalPlanTupleOperator {
    let res: LogicalPlanTupleOperator = new operators.MapFromItem(
      'xquery',
      node.variable,
      this.getItemSource(node.expr)
    );
    if (node.posVar) {
      res = new operators.ProjectionIndex('xquery', node.posVar, res);
    }
    res = this.maybeProjectConcat(res);
    if (node.allowEmpty) {
      if (res instanceof operators.ProjectionConcat) res.outer = true;
      else
        res = new operators.ProjectionConcat(
          'xquery',
          res,
          true,
          new operators.NullSource('xquery')
        );
      if (node.posVar) {
        (res as operators.ProjectionConcat).emptyVal.set(node.posVar.parts, 0);
      }
    }
    return res;
  }
  visitFLWORLet(node: AST.FLWORLet): LogicalPlanOperator {
    let res = this.operatorStack.pop() ?? new operators.NullSource('xquery');
    const attrs: Aliased<ASTIdentifier | operators.Calculation>[] =
      res.schema.map((x) => [x, x] as Aliased);
    for (const [varName, expr] of node.bindings) {
      attrs.push([this.toCalc(expr), varName]);
    }
    return new operators.Projection('xquery', attrs, res);
  }
  visitFLWORWindow(node: AST.FLWORWindow): LogicalPlanOperator {
    throw new UnsupportedError('Window clause not supported.');
  }
  visitFLWORWhere(node: AST.FLWORWhere): LogicalPlanOperator {
    return new operators.Selection(
      'xquery',
      this.toCalc(node.expr),
      this.operatorStack.pop()
    );
  }

  private processGroupByItem(
    item: [AST.ASTVariable, ASTNode]
  ): Aliased<ASTIdentifier | operators.Calculation> {
    return [this.toCalc(item[1]), item[0]];
  }
  visitFLWORGroupBy(node: AST.FLWORGroupBy): LogicalPlanOperator {
    const src = this.operatorStack.pop();
    const keySet = utils.schemaToTrie(node.bindings.map(retI0));
    const keys = node.bindings.map(this.processGroupByItem);
    return new operators.GroupBy(
      'xquery',
      keys,
      src.schema.filter((x) => !keySet.has(x.parts)).map(collectArg),
      src
    );
  }

  private processOrderItem(item: AST.OrderByItem): operators.Order {
    return {
      ascending: item.ascending,
      nullsFirst: item.emptyGreatest !== item.ascending,
      key: this.toCalc(item.expr),
    };
  }
  visitFLWOROrderBy(node: AST.FLWOROrderBy): LogicalPlanOperator {
    return new operators.OrderBy(
      'xquery',
      node.items.map(this.processOrderItem),
      this.operatorStack.pop()
    );
  }
  visitFLWORCount(node: AST.FLWORCount): LogicalPlanOperator {
    return new operators.ProjectionIndex(
      'xquery',
      node.variable,
      this.operatorStack.pop()
    );
  }
  visitFLWORReturn(node: AST.FLWORReturn): LogicalPlanOperator {
    if (node.expr instanceof AST.ASTVariable) {
      return new operators.MapToItem(
        'xquery',
        node.expr,
        this.operatorStack.pop()
      );
    }
    return new operators.MapToItem(
      'xquery',
      DOT,
      new operators.Projection(
        'xquery',
        [[this.toCalc(node.expr), DOT]],
        this.operatorStack.pop()
      )
    );
  }
  visitQuantifiedExpr(node: AST.QuantifiedExpr): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSwitchExpr(node: AST.SwitchExpr): LogicalPlanOperator {
    return new operators.Conditional(
      'xquery',
      node.expr && this.processNode(node.expr),
      node.cases.flatMap(([ws, t]) => {
        const then = this.processNode(t);
        return ws.map(
          (w) => [this.processNode(w), then] as [LogicalOpOrId, LogicalOpOrId]
        );
      }),
      node.defaultCase && this.processNode(node.defaultCase)
    );
  }
  visitIfExpr(node: AST.IfExpr): LogicalPlanOperator {
    return new operators.Conditional(
      'xquery',
      null,
      [[this.processNode(node.condition), this.processNode(node.then)]],
      node.elseExpr && this.processNode(node.elseExpr)
    );
  }
  visitSequenceType(node: AST.ASTSequenceType): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitInstanceOfExpr(node: AST.InstanceOfExpr): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCastExpr(node: AST.CastExpr): LogicalPlanOperator {
    const impl = this.langMgr.getCast('xquery', ...idToPair(node.type));
    return new operators.FnCall(
      'sql',
      [node.expr.accept(this)],
      impl.convert,
      impl.pure
    );
  }
  visitItemType(node: AST.ASTItemType): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }

  private processPathStart(first: ASTNode): LogicalPlanTupleOperator {
    let res: LogicalPlanTupleOperator;
    const stackTop = this.operatorStack[this.operatorStack.length - 1];
    if (first instanceof AST.ASTVariable) {
      if (stackTop?.schemaSet.has(first.parts)) {
        res = new operators.Projection('xquery', [[first, DOT]], stackTop);
      } else {
        res = new operators.MapFromItem(
          'xquery',
          DOT,
          new operators.ItemSource('xquery', first)
        );
      }
    } else {
      res = toTuples(first.accept(this));
    }

    this.operatorStack.push(res);
    return res;
  }
  private processPathStep(step: ASTNode) {
    if (step === DOT) {
      return this.operatorStack.pop();
    }
    if (step instanceof AST.FilterExpr) {
      return this.maybeProjectConcat(this.visitFilterExpr(step));
    } else if (step instanceof AST.PathAxis) {
      return step.accept(this) as LogicalPlanTupleOperator;
    } else {
      const calc = this.toCalc(step, false);
      return new TreeJoin('xquery', calc, this.operatorStack.pop());
    }
  }
  visitPathExpr(node: AST.PathExpr): LogicalPlanOperator {
    if (node.start) {
      throw new UnsupportedError('Only relative paths are supported');
    }
    let res = this.processPathStart(node.steps[0]);
    for (let i = 1; i < node.steps.length; i++) {
      res = this.processPathStep(node.steps[i]);
      this.operatorStack.push(res);
    }
    this.operatorStack.pop();
    return new operators.MapToItem('xquery', DOT, res);
  }

  /**
   * called only from {@link XQueryLogicalPlanBuilder#visitPathAxis}
   * or {@link XQueryLogicalPlanBuilder#visitFilterExpr}
   */
  visitPathPredicate(
    node: AST.PathPredicate,
    src?: LogicalPlanTupleOperator
  ): LogicalPlanTupleOperator {
    const calcParams = node.exprs.map(this.toCalcParams);
    let argI = 0;
    const args = calcParams.flatMap((p) => p.args);
    args.push(POS);
    const calc = new operators.Calculation(
      'xquery',
      (...args) => {
        const pos = args[args.length - 1];
        const res = calcParams.flatMap((p, i) =>
          p.impl(args.slice(argI, (argI += p.args.length)))
        );
        return typeof res === 'number' ? res === pos : toBool.convert(res);
      },
      args
    );
    return new operators.Selection('xquery', calc, src);
  }
  visitPathAxis(node: AST.PathAxis): LogicalPlanOperator {
    let res: LogicalPlanTupleOperator = new TreeJoin(
      'xquery',
      new operators.Calculation('xquery', treeStep(node.nodeTest, node.axis), [
        DOT,
      ]),
      this.operatorStack.pop()
    );
    for (const pred of node.predicates) {
      res = this.visitPathPredicate(pred, res);
    }
    return res;
  }
  visitFilterExpr(node: AST.FilterExpr): LogicalPlanTupleOperator {
    let res = toTuples(node.expr.accept(this));
    res = new operators.ProjectionIndex('xquery', POS, res);
    res = new ProjectionSize('xquery', LEN, res);
    return this.visitPathPredicate(node.predicate);
  }
  visitDynamicFunctionCall(node: AST.DynamicFunctionCall): LogicalPlanOperator {
    const args = node.args.map(this.processNode);
    args.push(node.nameOrExpr.accept(this));
    return new operators.FnCall('xquery', args, (...as) => as.pop()(...as));
  }
  visitSequenceConstructor(node: AST.SequenceConstructor): LogicalPlanOperator {
    return new operators.FnCall(
      'xquery',
      node.items.map(this.processNode),
      Array.of
    );
  }
  visitOrderedExpr(node: AST.OrderedExpr): LogicalPlanOperator {
    throw new UnsupportedError('Ordered expressions not supported');
  }
  visitDirectElementConstructor(
    node: AST.DirectElementConstructor
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitDirConstrContent(node: AST.DirConstrContent): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitModule(node: AST.Module): LogicalPlanOperator {
    // TODO: implement prolog
    let res = node.body[0].accept(this);
    for (let i = 1; i < node.body.length; i++) {
      res = new operators.Union('xquery', res, node.body[i].accept(this));
    }
    return res;
  }
  visitDirectPIConstructor(node: AST.DirectPIConstructor): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitDirectCommentConstructor(
    node: AST.DirectCommentConstructor
  ): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitComputedConstructor(node: AST.ComputedConstructor): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitInlineFn(node: AST.InlineFunction): LogicalPlanOperator {
    throw new UnsupportedError('Inline functions not supported');
  }
  visitBoundFunction(node: AST.BoundFunction): LogicalPlanOperator {
    const args = node.boundArgs.map(retI1).map(this.processNode);
    const impl =
      node.nameOrExpr instanceof ASTIdentifier &&
      !(node.nameOrExpr instanceof AST.ASTVariable)
        ? this.langMgr.getFn('xquery', ...idToPair(node.nameOrExpr)).impl
        : null;
    if (!impl) args.push(node.nameOrExpr.accept(this));
    const boundIndices = new Set(node.boundArgs.map(retI0));

    return new operators.FnCall('xquery', args, (...bound) => {
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
    return new operators.Literal('xquery', node.value);
  }
  visitOperator(node: ASTOperator): LogicalPlanOperator {
    return new operators.FnCall(
      'xquery',
      node.operands.map((x) => x.accept(this)),
      this.langMgr.getOp(node.lang, ...idToPair(node.id)).impl,
      true
    );
  }
  visitFunction(node: ASTFunction): LogicalPlanOperator {
    const [id, schema] = idToPair(node.id);
    const impl = this.langMgr.getFn(node.lang, id, schema);

    // TODO: aggregates?
    return new operators.FnCall(
      node.lang,
      node.args.map(this.processNode),
      impl.impl
    );
  }
  visitLangSwitch(node: LangSwitch): LogicalPlanOperator {
    const nested = new (this.langMgr.getLang(
      node.lang
    ).visitors.logicalPlanBuilder)(this.langMgr).buildPlan(node.node);
    if (nested instanceof LogicalPlanTupleOperator) {
      return new operators.MapToItem(
        'xquery',
        nested.schema.length === 1 ? nested.schema[0] : toId(allAttrs),
        nested
      );
    }
    return nested;
  }
  visitIdentifier(node: ASTIdentifier): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
}
