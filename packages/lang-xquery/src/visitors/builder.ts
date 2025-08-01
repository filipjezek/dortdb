import {
  ASTFunction,
  ASTIdentifier,
  ASTLiteral,
  ASTOperator,
  LangSwitch,
  ASTNode,
  LogicalPlanBuilder,
  PlanOperator,
  CalculationParams,
  PlanVisitor,
  UnsupportedError,
  PlanTupleOperator,
  Aliased,
  OpOrId,
  IdSet,
  boundParam,
  toInfer,
  DortDBAsFriend,
  EqualityChecker,
} from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import { XQueryVisitor } from '../ast/visitor.js';
import * as AST from '../ast/index.js';
import { DOT, LEN, POS } from '../utils/dot.js';
import { TreeJoin } from '../plan/tree-join.js';
import { treeStep } from '../language/tree-step.js';
import { toBool } from '../castables/basic-types.js';
import { ProjectionSize } from '../plan/projection-size.js';
import { collect } from '@dortdb/core/aggregates';
import {
  exprToSelection,
  intermediateToCalc,
  schemaToTrie,
  simplifyCalcParams,
  union,
} from '@dortdb/core/utils';
import { unwind } from '@dortdb/core/fns';
import {
  assertMaxOne,
  ret1,
  retI0,
  retI1,
  toPair,
} from '@dortdb/core/internal-fns';
import { FnContext } from '../functions/fn-context.js';
import { Trie } from '@dortdb/core/data-structures';
import { XQueryDataAdapter } from '../language/data-adapter.js';
import {
  XQueryAggregate,
  XQueryCastable,
  XQueryFn,
  XQueryLanguage,
  XQueryOp,
} from '../language/language.js';

export const skipAtomization = Symbol('skipAtomization');

function idToPair(id: ASTIdentifier): [string, string] {
  return [id.parts.at(-1) as string, id.parts.at(-2) as string];
}
function toId(id: string | symbol): ASTIdentifier {
  return AST.XQueryIdentifier.fromParts([id]);
}
function toTuples(op: PlanOperator) {
  return op instanceof PlanTupleOperator
    ? op
    : new plan.MapFromItem('xquery', DOT, op);
}
function collectArg(
  name: ASTIdentifier,
  src: PlanTupleOperator,
): plan.AggregateCall {
  return new plan.AggregateCall('xquery', [name], collect, name);
}
function coalesceSeq(seq: unknown) {
  if (
    seq === null ||
    seq === undefined ||
    (Array.isArray(seq) && seq.length === 0)
  ) {
    return [null];
  }
  return seq;
}
function infer(item: AST.ASTVariable, args: DescentArgs) {
  if (item.parts[0] !== boundParam && !args.ctx.has(item.parts)) {
    if (item.parts.length > 1 && args.ctx.has([item.parts[0], toInfer])) {
      args.inferred.add(item.parts);
    }
  }
}

interface DescentArgs {
  src?: PlanTupleOperator;
  ctx: IdSet;
  inferred: IdSet;
}

export const xhtml = 'http://www.w3.org/1999/xhtml';

export class XQueryLogicalPlanBuilder
  implements XQueryVisitor<PlanOperator, DescentArgs>, LogicalPlanBuilder
{
  protected calcBuilders: Record<string, PlanVisitor<CalculationParams>>;
  protected eqCheckers: Record<string, EqualityChecker>;
  protected prologOptions = {
    namespaces: new Map<string, string>([[undefined, xhtml]]),
  };
  protected prefixCounter = 0;
  protected dataAdapter: XQueryDataAdapter<unknown>;

  constructor(protected db: DortDBAsFriend) {
    this.calcBuilders = db.langMgr.getVisitorMap('calculationBuilder');
    this.eqCheckers = db.langMgr.getVisitorMap('equalityChecker');
    this.dataAdapter = db.langMgr.getLang<'xquery', XQueryLanguage>(
      'xquery',
    ).dataAdapter;
    this.atomize = this.atomize.bind(this);
  }

  buildPlan(node: ASTNode, ctx: IdSet) {
    const inferred = new Trie<string | symbol>();
    let res = node.accept(this, { ctx, inferred });
    if (res instanceof PlanTupleOperator && res.schema) {
      res = new plan.MapToItem('xquery', DOT, res);
    }
    return { plan: res, inferred };
  }

  protected toCalc(
    node: ASTNode,
    args: DescentArgs,
  ): plan.Calculation | ASTIdentifier;
  protected toCalc(
    node: ASTNode,
    args: DescentArgs,
    skipVars: false,
  ): plan.Calculation;
  protected toCalc(
    node: ASTNode,
    args: DescentArgs,
    skipVars = true,
  ): plan.Calculation | ASTIdentifier {
    if (node instanceof AST.ASTVariable) {
      infer(node, args);
      if (skipVars) return node;
    }
    const intermediate = node.accept(this, args);
    return intermediateToCalc(intermediate, this.calcBuilders, this.eqCheckers);
  }

  protected atomize(item: unknown) {
    return this.dataAdapter.atomize(item);
  }

  protected maybeUnwind(item: ASTNode, args: DescentArgs) {
    if (item instanceof AST.ASTVariable) {
      infer(item, args);
    }
    let res = item.accept(this, args);
    if (plan.CalcIntermediate in res) {
      res = intermediateToCalc(res, this.calcBuilders, this.eqCheckers);
      return new plan.ItemFnSource(
        'xquery',
        [res as plan.Calculation | ASTIdentifier],
        unwind.impl,
        toId(unwind.name),
      );
    }
    return res;
  }
  protected processNode(item: ASTNode, args: DescentArgs): OpOrId {
    if (item instanceof AST.ASTVariable) {
      infer(item, args);
      return item;
    }
    return item.accept(this, args);
  }
  protected processFnArg(
    item: ASTNode,
    args: DescentArgs,
  ): plan.PlanOpAsArg | ASTIdentifier {
    if (item instanceof AST.ASTVariable) {
      infer(item, args);
      return item;
    }
    return { op: item.accept(this, args), acceptSequence: true };
  }

  visitProlog(node: AST.Prolog, args: DescentArgs): PlanOperator {
    for (const decl of node.declarations) {
      decl.accept(this, args);
    }
    return null;
  }
  visitDefaultNSDeclaration(
    node: AST.DefaultNSDeclaration,
    args: DescentArgs,
  ): PlanOperator {
    this.prologOptions.namespaces.set(undefined, node.uri.value);
    return null;
  }
  visitBaseURIDeclaration(
    node: AST.BaseURIDeclaration,
    args: DescentArgs,
  ): PlanOperator {
    throw new UnsupportedError('Base URI declaration not supported.');
  }
  visitOrderingDeclaration(
    node: AST.OrderingDeclaration,
    args: DescentArgs,
  ): PlanOperator {
    throw new UnsupportedError('Ordering mode declaration not supported.');
  }
  visitEmptyOrderDeclaration(
    node: AST.EmptyOrderDeclaration,
    args: DescentArgs,
  ): PlanOperator {
    throw new UnsupportedError('Empty order declaration not supported.');
  }
  visitNSDeclaration(node: AST.NSDeclaration, args: DescentArgs): PlanOperator {
    this.prologOptions.namespaces.set(
      node.prefix.parts[0] as string,
      node.uri.value,
    );
    return null;
  }
  visitStringLiteral(
    node: AST.ASTStringLiteral,
    args: DescentArgs,
  ): PlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  visitNumberLiteral(
    node: AST.ASTNumberLiteral,
    args: DescentArgs,
  ): PlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  visitXQueryIdentifier(
    node: AST.XQueryIdentifier,
    args: DescentArgs,
  ): PlanOperator {
    return this.visitIdentifier(node, args);
  }
  visitVariable(node: AST.ASTVariable, args: DescentArgs): PlanOperator {
    if (
      node.parts[0] === boundParam ||
      args.ctx.has(node.parts) ||
      args.ctx.has([node.parts[0], toInfer])
    ) {
      if (args.ctx.has([node.parts[0], toInfer])) {
        args.inferred.add(node.parts);
      }
      const res = new plan.ItemFnSource(
        'xquery',
        [node],
        unwind.impl,
        ASTIdentifier.fromParts([unwind.name]),
      );
      return res;
    }
    return new plan.ItemSource('xquery', node);
  }
  visitFLWORExpr(node: AST.FLWORExpr, args: DescentArgs): PlanOperator {
    let res = node.clauses[0].accept(this, {
      ...args,
      src: null,
    }) as PlanTupleOperator;
    for (let i = 1; i < node.clauses.length; i++) {
      res = node.clauses[i].accept(this, {
        ...args,
        ctx: union(args.ctx, res.schema),
        src: res,
      }) as PlanTupleOperator;
    }
    return res;
  }

  protected maybeProjectConcat(
    op: PlanTupleOperator,
    src: PlanTupleOperator,
  ): PlanTupleOperator {
    if (src) {
      return new plan.ProjectionConcat('xquery', op, false, src);
    }
    return op;
  }
  visitFLWORFor(node: AST.FLWORFor, args: DescentArgs): PlanOperator {
    let res = this.visitFLWORForBinding(node.bindings[0], args);
    for (let i = 1; i < node.bindings.length; i++) {
      res = this.visitFLWORForBinding(node.bindings[i], {
        ...args,
        src: res,
      });
    }
    return res;
  }

  visitFLWORForBinding(
    node: AST.FLWORForBinding,
    args: DescentArgs,
  ): PlanTupleOperator {
    let res: PlanTupleOperator = new plan.MapFromItem(
      'xquery',
      node.variable,
      this.maybeUnwind(node.expr, {
        ctx: args.src ? union(args.ctx, args.src.schema) : args.ctx,
        inferred: args.inferred,
      }),
    );
    if (node.posVar) {
      res = new plan.ProjectionIndex('xquery', node.posVar, res);
    }
    res = this.maybeProjectConcat(res, args.src);
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
  visitFLWORLet(node: AST.FLWORLet, dargs: DescentArgs): PlanOperator {
    const res = dargs.src ?? new plan.NullSource('xquery');
    const attrs: Aliased<ASTIdentifier | plan.Calculation>[] =
      res.schema.map(toPair);
    for (const [varName, expr] of node.bindings) {
      const calc = this.toCalc(expr, { ...dargs, src: null }, false);
      attrs.push([calc, varName]);
    }
    return new plan.Projection('xquery', attrs, res);
  }
  visitFLWORWindow(node: AST.FLWORWindow, args: DescentArgs): PlanOperator {
    throw new UnsupportedError('Window clause not supported.');
  }
  visitFLWORWhere(node: AST.FLWORWhere, args: DescentArgs): PlanOperator {
    return exprToSelection(
      this.processNode(node.expr, {
        ...args,
        src: null,
      }),
      args.src,
      this.calcBuilders,
      this.eqCheckers,
      'xquery',
    );
  }

  protected processGroupByItem(
    item: [AST.ASTVariable, ASTNode],
    args: DescentArgs,
  ): Aliased<ASTIdentifier | plan.Calculation> {
    const keyExpr = this.processFnArg(item[1], args);
    const fn = new plan.FnCall('xquery', [keyExpr], this.atomize, true);
    return [
      intermediateToCalc(fn, this.calcBuilders, this.eqCheckers),
      item[0],
    ];
  }
  visitFLWORGroupBy(node: AST.FLWORGroupBy, args: DescentArgs): PlanOperator {
    const keySet = schemaToTrie(node.bindings.map(retI0));
    const keys = node.bindings.map((x) =>
      this.processGroupByItem(x, { ...args, src: null }),
    );
    return new plan.GroupBy(
      'xquery',
      keys,
      args.src.schema
        .filter((x) => !keySet.has(x.parts))
        .map((x) => collectArg(x, args.src)),
      args.src,
    );
  }

  protected processOrderItem(
    item: AST.OrderByItem,
    args: DescentArgs,
  ): plan.Order {
    return {
      ascending: item.ascending,
      nullsFirst: item.emptyGreatest !== item.ascending,
      key: this.toCalc(item.expr, args),
    };
  }
  visitFLWOROrderBy(node: AST.FLWOROrderBy, args: DescentArgs): PlanOperator {
    return new plan.OrderBy(
      'xquery',
      node.items.map((i) => this.processOrderItem(i, { ...args, src: null })),
      args.src,
    );
  }
  visitFLWORCount(node: AST.FLWORCount, args: DescentArgs): PlanOperator {
    return new plan.ProjectionIndex('xquery', node.variable, args.src);
  }

  visitFLWORReturn(node: AST.FLWORReturn, args: DescentArgs): PlanOperator {
    let expr: PlanOperator | ASTIdentifier;
    if (node.expr instanceof AST.ASTVariable) {
      infer(node.expr, args);
      expr = node.expr.accept(this, { ...args, src: null });
      expr = new plan.MapFromItem('xquery', DOT, expr);
      expr = new plan.ProjectionConcat(
        'xquery',
        expr as PlanTupleOperator,
        false,
        args.src,
      );
      return new plan.MapToItem('xquery', DOT, expr as PlanTupleOperator);
    }
    return new plan.MapToItem(
      'xquery',
      DOT,
      new plan.ProjectionConcat(
        'xquery',
        new plan.MapFromItem(
          'xquery',
          DOT,
          new plan.ItemFnSource(
            'xquery',
            [DOT],
            unwind.impl,
            ASTIdentifier.fromParts([unwind.name]),
          ),
        ),
        false,
        new plan.Projection(
          'xquery',
          [[this.toCalc(node.expr, { ...args, src: null }, false), DOT]],
          args.src,
        ),
      ),
    );
  }

  visitQuantifiedExpr(
    node: AST.QuantifiedExpr,
    args: DescentArgs,
  ): PlanOperator {
    const invert = node.quantifier === AST.Quantifier.EVERY;
    let subq: PlanTupleOperator = null;
    for (const [variable, expr] of node.variables) {
      subq = this.visitFLWORForBinding(
        { expr, variable } as AST.FLWORForBinding,
        { ...args, src: subq },
      );
    }

    const calc = this.toCalc(
      node.expr,
      { ctx: union(args.ctx, subq.schema), inferred: args.inferred },
      false,
    );
    if (invert) {
      const oldImpl = calc.impl;
      calc.impl = (...args) => !oldImpl(...args);
    }
    subq = new plan.Selection('xquery', calc, subq);
    subq = new plan.Limit('xquery', 0, 1, subq);
    subq = new plan.Projection(
      'xquery',
      [
        [
          new plan.Calculation('xquery', () => !invert, [], [], null, [], true),
          DOT,
        ],
      ],
      subq,
    );
    return new plan.FnCall(
      'xquery',
      [{ op: subq }],
      (x) => x !== null && x !== undefined,
      true,
    );
  }
  visitSwitchExpr(node: AST.SwitchExpr, args: DescentArgs): PlanOperator {
    return new plan.Conditional(
      'xquery',
      node.expr && this.processNode(node.expr, args),
      node.cases.flatMap(([ws, t]) => {
        const then = this.processNode(t, args);
        return ws.map(
          (w) => [this.processNode(w, args), then] as [OpOrId, OpOrId],
        );
      }),
      node.defaultCase && this.processNode(node.defaultCase, args),
    );
  }
  visitIfExpr(node: AST.IfExpr, args: DescentArgs): PlanOperator {
    return new plan.Conditional(
      'xquery',
      null,
      [
        [
          this.processNode(node.condition, args),
          this.processNode(node.then, args),
        ],
      ],
      node.elseExpr && this.processNode(node.elseExpr, args),
    );
  }
  visitSequenceType(
    node: AST.ASTSequenceType,
    args: DescentArgs,
  ): PlanOperator {
    throw new Error('Method not implemented.');
  }
  visitInstanceOfExpr(
    node: AST.InstanceOfExpr,
    args: DescentArgs,
  ): PlanOperator {
    throw new UnsupportedError('Instanceof not supported.');
  }
  visitCastExpr(node: AST.CastExpr, args: DescentArgs): PlanOperator {
    const impl = this.db.langMgr.getCast(
      'xquery',
      ...idToPair(node.type),
    ) as XQueryCastable;
    return new plan.FnCall(
      'sql',
      [{ op: node.expr.accept(this, args) }],
      impl.skipAtomization
        ? impl.convert
        : (arg) => impl.convert(this.atomize(arg)),
      impl.pure,
    );
  }
  visitItemType(node: AST.ASTItemType, args: DescentArgs): PlanOperator {
    throw new Error('Method not implemented.');
  }

  protected processPathStart(
    first: ASTNode,
    args: DescentArgs,
  ): PlanTupleOperator {
    if (first instanceof AST.PathAxis) {
      if (!args.ctx.has(DOT.parts)) {
        throw new Error(
          `No clear context for path start: ${first.nodeTest.name === '*' ? '*' : first.nodeTest.name.parts.join(':')}`,
        );
      }
      return this.visitPathAxis(first, {
        ...args,
        src: toTuples(
          new plan.ItemFnSource(
            'xquery',
            [DOT],
            unwind.impl,
            toId(unwind.name),
          ),
        ),
      });
    }
    let res = first.accept(this, args);
    if (plan.CalcIntermediate in res) {
      res = intermediateToCalc(res, this.calcBuilders, this.eqCheckers);
      return new TreeJoin(
        'xquery',
        res as plan.Calculation,
        args.src ?? new plan.NullSource('xquery'),
        false,
      );
    } else if (
      !(res instanceof PlanTupleOperator) ||
      [DOT, POS, LEN].some(
        (x) => !(res as PlanTupleOperator).schemaSet.has(x.parts),
      )
    ) {
      return new TreeJoin(
        'xquery',
        new plan.Calculation(
          'xquery',
          ret1,
          [res],
          [{ acceptSequence: true, originalLocations: [] }],
        ),
        args.src ?? new plan.NullSource('xquery'),
        false,
      );
    }
    return res as PlanTupleOperator;
  }
  protected processPathStep(
    step: ASTNode,
    removeDuplicates: boolean,
    args: DescentArgs,
  ) {
    if (step === DOT) {
      return args.src;
    }
    if (step instanceof AST.FilterExpr) {
      return this.maybeProjectConcat(
        this.visitFilterExpr(step, {
          ctx: union(args.ctx, args.src.schema),
          inferred: args.inferred,
        }),
        args.src,
      );
    } else if (step instanceof AST.PathAxis) {
      return step.accept(this, args) as PlanTupleOperator;
    } else {
      const calc = this.toCalc(
        step,
        { ctx: union(args.ctx, args.src.schema), inferred: args.inferred },
        false,
      );
      if (calc.impl === assertMaxOne) calc.impl = ret1;
      return new TreeJoin('xquery', calc, args.src, removeDuplicates);
    }
  }
  visitPathExpr(node: AST.PathExpr, args: DescentArgs): PlanOperator {
    if (node.start) {
      throw new UnsupportedError('Only relative paths are supported');
    }
    let res = this.processPathStart(node.steps[0], args);
    for (let i = 1; i < node.steps.length; i++) {
      res = this.processPathStep(node.steps[i], true, { ...args, src: res });
    }
    return new plan.MapToItem('xquery', DOT, res);
  }
  visitSimpleMapExpr(node: AST.SimpleMapExpr, args: DescentArgs): PlanOperator {
    let res = this.processPathStart(node.source, args);
    res = this.processPathStep(node.mapping, false, { ...args, src: res });
    return res;
  }

  visitPathPredicate(
    node: AST.PathPredicate,
    dargs: DescentArgs,
  ): PlanTupleOperator {
    const calcCtx = union(dargs.ctx, dargs.src.schema);
    const args = node.exprs.map((x) =>
      this.processFnArg(x, { ctx: calcCtx, inferred: dargs.inferred }),
    );
    args.push(POS);
    const calc = intermediateToCalc(
      new plan.FnCall('xquery', args, (...args) => {
        const pos = args.at(-1);
        const actualArgs = args.slice(0, -1);
        return actualArgs.length === 1 && typeof actualArgs[0] === 'number'
          ? actualArgs[0] === pos
          : toBool.convert(actualArgs);
      }),
      this.calcBuilders,
      this.eqCheckers,
    );
    return new plan.Selection('xquery', calc, dargs.src);
  }
  visitPathAxis(node: AST.PathAxis, args: DescentArgs): PlanTupleOperator {
    let res: PlanTupleOperator = new TreeJoin(
      'xquery',
      new plan.Calculation(
        'xquery',
        treeStep(node.nodeTest, node.axis),
        [DOT],
        [undefined],
      ),
      args.src,
    );
    for (const pred of node.predicates) {
      res = this.visitPathPredicate(pred, { ...args, src: res });
    }
    return res;
  }
  visitFilterExpr(node: AST.FilterExpr, args: DescentArgs): PlanTupleOperator {
    let res = toTuples(node.expr.accept(this, args));
    res = new plan.ProjectionIndex('xquery', POS, res);
    res = new ProjectionSize('xquery', LEN, res);
    return this.visitPathPredicate(node.predicate, { ...args, src: res });
  }
  visitDynamicFunctionCall(
    node: AST.DynamicFunctionCall,
    dargs: DescentArgs,
  ): PlanOperator {
    const args = node.args.map((x) => this.processFnArg(x, dargs));
    args.push({ op: node.nameOrExpr.accept(this, dargs) });
    return new plan.FnCall('xquery', args, (...as) => {
      const fn = as.pop();
      if (!fn[skipAtomization]) return fn(...as.map(this.atomize));
      return fn(...as);
    });
  }
  visitSequenceConstructor(
    node: AST.SequenceConstructor,
    dargs: DescentArgs,
  ): PlanOperator {
    return new plan.FnCall(
      'xquery',
      node.items.map((x) => this.processFnArg(x, dargs)),
      (...args) => args.flat(Infinity),
    );
  }
  visitOrderedExpr(node: AST.OrderedExpr, args: DescentArgs): PlanOperator {
    throw new UnsupportedError('Ordered expressions not supported');
  }

  /** returns [ns uri, prefixed:name] */
  protected idToQName(id: ASTIdentifier, source?: unknown): [string, string] {
    const local = id.parts.at(-1) as string;
    const schema = id.parts.at(-2) as string;
    if (schema && URL.canParse(schema)) {
      const prefix =
        (source && this.dataAdapter.lookupPrefix(source, schema)) ??
        `pref${this.prefixCounter++}`;
      return [schema, `${prefix}:${local}`];
    }
    const uri =
      (source && this.dataAdapter.lookupNSUri(source, schema)) ??
      this.prologOptions.namespaces.get(schema);
    return [uri, schema ? `${schema}:${local}` : local];
  }
  protected processDirConstrContent(
    content: string | ASTNode,
    args: DescentArgs,
  ) {
    if (typeof content === 'string') {
      return { op: new plan.Literal('xquery', content) } as plan.PlanOpAsArg;
    }
    return this.processFnArg(content, args);
  }
  visitDirectElementConstructor(
    node: AST.DirectElementConstructor,
    dargs: DescentArgs,
  ): PlanOperator {
    const [ns, qname] = this.idToQName(node.name);
    const content = node.content.content
      .flat()
      .map((x) => this.processDirConstrContent(x, dargs));
    for (const [id, val] of node.attributes) {
      const args = val.content
        .flat()
        .map((x) => this.processDirConstrContent(x, dargs));
      content.push({
        op: new plan.FnCall('xquery', args, (...vals) => {
          return vals.map(this.atomize).join('');
        }),
      });
    }
    return new plan.FnCall('xquery', content, (...args) => {
      const el = this.dataAdapter.createElement(
        ns,
        qname,
        args.slice(0, -node.attributes.length),
      );
      for (let i = 0; i < node.attributes.length; i++) {
        const [id] = node.attributes[i];
        const [ans, aqname] = this.idToQName(id, el);
        this.dataAdapter.addAttribute(
          el,
          this.dataAdapter.createAttribute(
            ans,
            aqname,
            this.atomize(
              args[args.length - node.attributes.length + i],
            ).toString(),
          ),
        );
      }
      return el;
    });
  }
  visitDirConstrContent(
    node: AST.DirConstrContent,
    args: DescentArgs,
  ): PlanOperator {
    throw new Error('Method not implemented.');
  }
  visitModule(node: AST.Module, args: DescentArgs): PlanOperator {
    node.prolog.accept(this, args);
    let res = this.maybeUnwind(node.body[0], args);
    for (let i = 1; i < node.body.length; i++) {
      res = new plan.Union('xquery', res, this.maybeUnwind(node.body[i], args));
    }
    return res;
  }
  visitDirectPIConstructor(
    node: AST.DirectPIConstructor,
    args: DescentArgs,
  ): PlanOperator {
    return new plan.FnCall('xquery', [], () =>
      this.dataAdapter.createProcInstr(node.name, node.content),
    );
  }
  visitDirectCommentConstructor(
    node: AST.DirectCommentConstructor,
    args: DescentArgs,
  ): PlanOperator {
    return new plan.FnCall('xquery', [], () =>
      this.dataAdapter.createComment(node.content),
    );
  }
  visitComputedConstructor(
    node: AST.ComputedConstructor,
    args: DescentArgs,
  ): PlanOperator {
    let ns: string, qname: string;
    const content = node.content.map((x) => this.processFnArg(x, args));
    if (
      node.name instanceof ASTIdentifier &&
      !(node.name instanceof AST.ASTVariable)
    ) {
      [ns, qname] = this.idToQName(node.name);
    } else if (node.name) {
      content.push(this.processFnArg(node.name, args));
    }
    switch (node.type) {
      case AST.ConstructorType.ATTRIBUTE:
        return new plan.FnCall('xquery', content, (...args) => {
          if (!qname) {
            [ns, qname] = this.idToQName(args.pop());
          }
          return this.dataAdapter.createAttribute(
            ns,
            qname,
            args.map(this.atomize).join(''),
          );
        });
      case AST.ConstructorType.COMMENT:
        return new plan.FnCall('xquery', content, (...args) => {
          return this.dataAdapter.createComment(
            args.map(this.atomize).join(''),
          );
        });
      case AST.ConstructorType.DOCUMENT:
      case AST.ConstructorType.ELEMENT:
        return new plan.FnCall('xquery', content, (...args) => {
          if (!qname && node.name) {
            [ns, qname] = this.idToQName(args.pop());
          }
          return this.dataAdapter[
            node.type === AST.ConstructorType.DOCUMENT
              ? 'createDocument'
              : 'createElement'
          ](ns, qname, args);
        });
      case AST.ConstructorType.NAMESPACE:
        return new plan.FnCall('xquery', content, (...args) => {
          if (!qname) qname = args.pop();
          return this.dataAdapter.createNS(
            qname,
            args.map(this.atomize).join(''),
          );
        });
      case AST.ConstructorType.PROCESSING_INSTRUCTION:
        return new plan.FnCall('xquery', content, (...args) => {
          if (!qname) qname = args.pop();
          return this.dataAdapter.createProcInstr(
            qname,
            args.map(this.atomize).join(''),
          );
        });
      case AST.ConstructorType.TEXT:
        return new plan.FnCall('xquery', content, (...args) => {
          return this.dataAdapter.createText(args.map(this.atomize).join(''));
        });
    }
  }
  visitInlineFn(node: AST.InlineFunction, args: DescentArgs): PlanOperator {
    throw new UnsupportedError('Inline functions not supported');
  }
  visitBoundFunction(
    node: AST.BoundFunction,
    dargs: DescentArgs,
  ): PlanOperator {
    const args = node.boundArgs
      .map(retI1)
      .map((x) => this.processFnArg(x, dargs));
    const impl =
      node.nameOrExpr instanceof ASTIdentifier &&
      !(node.nameOrExpr instanceof AST.ASTVariable)
        ? this.db.langMgr.getFn('xquery', ...idToPair(node.nameOrExpr))
        : null;
    if (!impl) args.push({ op: node.nameOrExpr.accept(this, dargs) });
    else {
      (impl.impl as any)[skipAtomization] = (impl as XQueryFn).skipAtomization;
    }
    const boundIndices = new Set(node.boundArgs.map(retI0));

    return new plan.FnCall('xquery', args, (...bound) => {
      const fn = impl?.impl ?? bound.pop();
      return (...unbound: unknown[]) => {
        const fullSize = unbound.length + bound.length;
        const allArgs = Array(fullSize);
        let bi = 0;
        let ui = 0;
        for (let i = 0; i < fullSize; i++) {
          allArgs[i] = boundIndices.has(i) ? bound[bi++] : unbound[ui++];
        }
        if (fn[skipAtomization]) {
          return fn(...allArgs);
        }
        return fn(...allArgs.map(this.atomize));
      };
    });
  }
  visitLiteral<U>(node: ASTLiteral<U>, args: DescentArgs): PlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  protected processOpArg(item: ASTNode, args: DescentArgs): plan.PlanOpAsArg {
    if (item instanceof AST.ASTVariable) {
      infer(item, args);
      return {
        op: new plan.FnCall('xquery', [item], ret1),
        acceptSequence: true,
      };
    }
    return { op: item.accept(this, args), acceptSequence: true };
  }
  visitOperator(node: ASTOperator, args: DescentArgs): PlanOperator {
    const op = this.db.langMgr.getOp(
      node.lang,
      ...idToPair(node.id),
    ) as XQueryOp;
    return new plan.FnCall(
      'xquery',
      node.operands.map((x) => this.processOpArg(x, args)),
      op.skipAtomization
        ? op.impl
        : (...args) => op.impl(...args.map(this.atomize)),
      true,
    );
  }

  protected renameAggSource(
    src: PlanTupleOperator,
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
  protected joinAggArgs(args: PlanTupleOperator[]) {
    const colNames = args.map((_, i) => toId(i + ''));
    const posNames = args.map((_, i) => toId('i' + i));
    const countNames = args.map((_, i) => toId('c' + i));
    let joined: PlanTupleOperator = this.renameAggSource(
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
        [
          new plan.Calculation(
            'xquery',
            (i1, i2, c1, c2) => i1 === i2 || c1 === 1 || c2 === 1,
            [posNames[i - 1], posNames[i], countNames[i - 1], countNames[i]],
            [undefined, undefined, undefined, undefined],
          ),
        ],
      );
      (joined as plan.Join).leftOuter = (joined as plan.Join).rightOuter = true;
    }
    return joined;
  }

  protected prepareAggArg(arg: PlanOperator): PlanTupleOperator {
    if (plan.CalcIntermediate in arg) {
      let calcParams = arg.accept(this.calcBuilders);
      calcParams = simplifyCalcParams(calcParams, this.eqCheckers, 'xquery');

      if (calcParams.literal) {
        const ret = coalesceSeq(calcParams.impl());
        calcParams.impl = () => ret;
      } else {
        const oldImpl = calcParams.impl;
        calcParams.impl = (...args) => coalesceSeq(oldImpl(...args));
      }

      arg = new plan.Calculation(
        'xquery',
        calcParams.impl,
        calcParams.args,
        calcParams.argMeta,
        null,
        calcParams.aggregates,
        calcParams.literal,
      );
      arg = new plan.ItemFnSource(
        'xquery',
        [arg as plan.Calculation],
        unwind.impl,
        toId(unwind.name),
      );
    }
    return toTuples(arg);
  }

  protected processAggregateFn(
    node: ASTFunction,
    dargs: DescentArgs,
    impl: XQueryAggregate,
  ): PlanOperator {
    const args = node.args.map((x) =>
      this.prepareAggArg(x.accept(this, dargs)),
    );
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
            {
              ...impl,
              step: impl.skipAtomization
                ? impl.step
                : (state, ...vals) =>
                    impl.step(state, ...vals.map(this.atomize)),
            },
            DOT,
          ),
        ],
        this.joinAggArgs(args),
      );
    }
    gb.aggs[0].postGroupOp.schema = gb.source.schema;
    gb.aggs[0].postGroupOp.schemaSet = gb.source.schemaSet;

    return new plan.MapToItem('xquery', DOT, gb);
  }

  visitFunction(node: ASTFunction, dargs: DescentArgs): PlanOperator {
    const [id, schema] = idToPair(node.id);
    let impl: XQueryFn | XQueryAggregate;
    try {
      impl = this.db.langMgr.getFnOrAggr(node.lang, id, schema);
    } catch (e) {
      const cast = this.db.langMgr.getCast(node.lang, id, schema);
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

    if ('impl' in impl) {
      const args = [
        DOT,
        LEN,
        POS,
        ...node.args.map((a) => this.processFnArg(a, dargs)),
      ];
      return new plan.FnCall(
        node.lang,
        args,
        impl.skipAtomization
          ? (dot, len, pos, ...args) =>
              impl.impl(...(args.length ? args : [dot]), {
                item: dot,
                position: pos,
                size: len,
              } as FnContext)
          : (dot, len, pos, ...args) =>
              impl.impl(...(args.length ? args : [dot]).map(this.atomize), {
                item: this.atomize(dot),
                position: pos,
                size: len,
              } as FnContext),
        impl.pure,
      );
    }

    return this.processAggregateFn(node, dargs, impl);
  }
  visitLangSwitch(node: LangSwitch, args: DescentArgs): PlanOperator {
    const nested = new (this.db.langMgr.getLang(
      node.lang,
    ).visitors.logicalPlanBuilder)(this.db).buildPlan(node.node, args.ctx);
    for (const item of nested.inferred) {
      args.inferred.add(item);
    }
    if (nested.plan instanceof PlanTupleOperator) {
      return new plan.MapToItem('xquery', null, nested.plan);
    }
    return nested.plan;
  }
  visitIdentifier(node: ASTIdentifier, args: DescentArgs): PlanOperator {
    throw new Error('Method not implemented.');
  }
}
