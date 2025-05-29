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
  Fn,
  AggregateFn,
  simplifyCalcParams,
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
  resolveArgs,
  schemaToTrie,
  union,
} from '@dortdb/core/utils';
import { unwind } from '@dortdb/core/fns';
import { ret1, retI0, retI1, toPair } from '@dortdb/core/internal-fns';
import { FnContext } from '../functions/fn-context.js';
import { Trie } from '@dortdb/core/data-structures';
import { XQueryDataAdapter } from '../language/data-adapter.js';
import { XQueryLanguage } from '../language/language.js';

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
function collectArg(name: ASTIdentifier): plan.AggregateCall {
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
function getArgs(p: CalculationParams) {
  return p.args;
}
function getMeta(p: CalculationParams) {
  return p.argMeta;
}

interface DescentArgs {
  src?: PlanTupleOperator;
  ctx: IdSet;
  inferred: IdSet;
}

export class XQueryLogicalPlanBuilder
  implements XQueryVisitor<PlanOperator, DescentArgs>, LogicalPlanBuilder
{
  private calcBuilders: Record<string, PlanVisitor<CalculationParams>>;
  private eqCheckers: Record<string, EqualityChecker>;
  private prologOptions = {
    namespaces: new Map<string, string>([
      [undefined, 'http://www.w3.org/1999/xhtml'],
    ]),
  };
  private prefixCounter = 0;
  private dataAdapter: XQueryDataAdapter<unknown>;

  constructor(private db: DortDBAsFriend) {
    this.calcBuilders = db.langMgr.getVisitorMap('calculationBuilder');
    this.eqCheckers = db.langMgr.getVisitorMap('equalityChecker');
    this.dataAdapter = db.langMgr.getLang<'xquery', XQueryLanguage>(
      'xquery',
    ).dataAdapter;
  }

  buildPlan(node: ASTNode, ctx: IdSet) {
    const inferred = new Trie<string | symbol>();
    let res = node.accept(this, { ctx, inferred });
    if (res instanceof PlanTupleOperator) {
      res = new plan.MapToItem('xquery', DOT, res);
    }
    return { plan: res, inferred };
  }

  private toCalc(
    node: ASTNode,
    args: DescentArgs,
  ): plan.Calculation | ASTIdentifier;
  private toCalc(
    node: ASTNode,
    args: DescentArgs,
    skipVars: false,
  ): plan.Calculation;
  private toCalc(
    node: ASTNode,
    args: DescentArgs,
    skipVars = true,
  ): plan.Calculation | ASTIdentifier {
    if (node instanceof AST.ASTVariable) {
      infer(node, args);
      if (skipVars) return node;
    }
    const intermediate = node.accept(this, args);
    let calcParams = intermediate.accept(this.calcBuilders);
    calcParams = simplifyCalcParams(calcParams, this.eqCheckers, 'xquery');
    return new plan.Calculation(
      'xquery',
      calcParams.impl,
      calcParams.args,
      calcParams.argMeta,
      intermediate,
      calcParams.aggregates,
      calcParams.literal,
    );
  }

  private maybeToCalc(item: ASTNode, args: DescentArgs) {
    const res = item.accept(this, args);
    if (plan.CalcIntermediate in res) {
      let params = res.accept(this.calcBuilders);
      params = simplifyCalcParams(params, this.eqCheckers, 'xquery');
      return new plan.Calculation(
        'xquery',
        params.impl,
        params.args,
        params.argMeta,
        res,
        params.aggregates,
        params.literal,
      );
    }
    return res;
  }
  private processNode(item: ASTNode, args: DescentArgs): OpOrId {
    if (item instanceof AST.ASTVariable) {
      infer(item, args);
      return item;
    }
    return item.accept(this, args);
  }
  private processFnArg(
    item: ASTNode,
    args: DescentArgs,
  ): plan.PlanOpAsArg | ASTIdentifier {
    if (item instanceof AST.ASTVariable) {
      infer(item, args);
      return item;
    }
    return { op: item.accept(this, args) };
  }
  private toCalcParams(node: ASTNode, args: DescentArgs) {
    return node.accept(this, args).accept(this.calcBuilders);
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
        src: res,
      }) as PlanTupleOperator;
    }
    return res;
  }

  private maybeProjectConcat(
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
      this.maybeToCalc(node.expr, {
        ctx: args.src ? union(args.ctx, args.src.schemaSet) : args.ctx,
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
    const attrCtx = dargs.src
      ? union(dargs.ctx, dargs.src.schemaSet)
      : dargs.ctx;
    for (const [varName, expr] of node.bindings) {
      const calc = this.toCalc(
        expr,
        { ctx: attrCtx, inferred: dargs.inferred },
        false,
      );
      if (calc instanceof plan.Calculation) {
        calc.impl = (...args) => {
          const res = calc.impl(...args);
          return Array.isArray(res) ? res.flat(Infinity) : res;
        };
      }
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
        ctx: union(args.ctx, args.src.schemaSet),
        inferred: args.inferred,
      }),
      args.src,
      this.calcBuilders,
      this.eqCheckers,
      'xquery',
    );
  }

  private processGroupByItem(
    item: [AST.ASTVariable, ASTNode],
    args: DescentArgs,
  ): Aliased<ASTIdentifier | plan.Calculation> {
    return [this.toCalc(item[1], args), item[0]];
  }
  visitFLWORGroupBy(node: AST.FLWORGroupBy, args: DescentArgs): PlanOperator {
    const keySet = schemaToTrie(node.bindings.map(retI0));
    const keys = node.bindings.map((x) => this.processGroupByItem(x, args));
    return new plan.GroupBy(
      'xquery',
      keys,
      args.src.schema.filter((x) => !keySet.has(x.parts)).map(collectArg),
      args.src,
    );
  }

  private processOrderItem(
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
    const attrCtx = union(args.ctx, args.src.schemaSet);
    return new plan.OrderBy(
      'xquery',
      node.items.map((i) =>
        this.processOrderItem(i, { ctx: attrCtx, inferred: args.inferred }),
      ),
      args.src,
    );
  }
  visitFLWORCount(node: AST.FLWORCount, args: DescentArgs): PlanOperator {
    return new plan.ProjectionIndex('xquery', node.variable, args.src);
  }
  visitFLWORReturn(node: AST.FLWORReturn, args: DescentArgs): PlanOperator {
    if (node.expr instanceof AST.ASTVariable) {
      infer(node.expr, args);
      return new plan.MapToItem('xquery', node.expr, args.src);
    }
    return new plan.MapToItem(
      'xquery',
      DOT,
      new plan.Projection(
        'xquery',
        [
          [
            this.toCalc(node.expr, {
              ctx: union(args.ctx, args.src.schemaSet),
              inferred: args.inferred,
            }),
            DOT,
          ],
        ],
        args.src,
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
      { ctx: union(args.ctx, subq.schemaSet), inferred: args.inferred },
      false,
    );
    if (invert) calc.impl = (...args) => !calc.impl(...args);
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
    const impl = this.db.langMgr.getCast('xquery', ...idToPair(node.type));
    return new plan.FnCall(
      'sql',
      [{ op: node.expr.accept(this, args) }],
      impl.convert,
      impl.pure,
    );
  }
  visitItemType(node: AST.ASTItemType, args: DescentArgs): PlanOperator {
    throw new Error('Method not implemented.');
  }

  private processPathStart(
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
    const res = toTuples(first.accept(this, args));
    return res;
  }
  private processPathStep(step: ASTNode, args: DescentArgs) {
    if (step === DOT) {
      return args.src;
    }
    if (step instanceof AST.FilterExpr) {
      return this.maybeProjectConcat(
        this.visitFilterExpr(step, {
          ctx: union(args.ctx, args.src.schemaSet),
          inferred: args.inferred,
        }),
        args.src,
      );
    } else if (step instanceof AST.PathAxis) {
      return step.accept(this, args) as PlanTupleOperator;
    } else {
      const calc = this.toCalc(
        step,
        { ctx: union(args.ctx, args.src.schemaSet), inferred: args.inferred },
        false,
      );
      return new TreeJoin('xquery', calc, args.src);
    }
  }
  visitPathExpr(node: AST.PathExpr, args: DescentArgs): PlanOperator {
    if (node.start) {
      throw new UnsupportedError('Only relative paths are supported');
    }
    let res = this.processPathStart(node.steps[0], args);
    for (let i = 1; i < node.steps.length; i++) {
      res = this.processPathStep(node.steps[i], { ...args, src: res });
    }
    return new plan.MapToItem('xquery', DOT, res);
  }

  visitPathPredicate(
    node: AST.PathPredicate,
    dargs: DescentArgs,
  ): PlanTupleOperator {
    const calcCtx = union(dargs.ctx, dargs.src.schemaSet);
    const calcParams = node.exprs.map((x) =>
      this.toCalcParams(x, { ctx: calcCtx, inferred: dargs.inferred }),
    );
    const args = calcParams.flatMap(getArgs);
    args.push(POS);
    const metas = calcParams.flatMap(getMeta);
    metas.push(undefined);
    const calc = new plan.Calculation(
      'xquery',
      (...args) => {
        const pos = args.at(-1);
        // TODO: handle sequences
        const res = resolveArgs(args, calcParams).flat()[0];
        return typeof res === 'number' ? res === pos : toBool.convert(res);
      },
      args,
      metas,
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
    return new plan.FnCall('xquery', args, (...as) => as.pop()(...as));
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
  private idToQName(id: ASTIdentifier, source?: unknown): [string, string] {
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
  private processDirConstrContent(
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
          vals.join('');
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
            args[args.length - node.attributes.length + i],
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
    let res = this.maybeToCalc(node.body[0], args);
    for (let i = 1; i < node.body.length; i++) {
      res = new plan.Union('xquery', res, this.maybeToCalc(node.body[i], args));
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
          return this.dataAdapter.createAttribute(ns, qname, args.join(''));
        });
      case AST.ConstructorType.COMMENT:
        return new plan.FnCall('xquery', content, (...args) => {
          return this.dataAdapter.createComment(args.join(''));
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
          return this.dataAdapter.createNS(qname, args.join(''));
        });
      case AST.ConstructorType.PROCESSING_INSTRUCTION:
        return new plan.FnCall('xquery', content, (...args) => {
          if (!qname) qname = args.pop();
          return this.dataAdapter.createProcInstr(qname, args.join(''));
        });
      case AST.ConstructorType.TEXT:
        return new plan.FnCall('xquery', content, (...args) => {
          return this.dataAdapter.createText(args.join(''));
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
        ? this.db.langMgr.getFn('xquery', ...idToPair(node.nameOrExpr)).impl
        : null;
    if (!impl) args.push({ op: node.nameOrExpr.accept(this, dargs) });
    const boundIndices = new Set(node.boundArgs.map(retI0));

    return new plan.FnCall('xquery', args, (...bound) => {
      const fn = impl ?? bound.pop();
      return (...unbound: unknown[]) => {
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
  visitLiteral<U>(node: ASTLiteral<U>, args: DescentArgs): PlanOperator {
    return new plan.Literal('xquery', node.value);
  }
  private processOpArg(item: ASTNode, args: DescentArgs): plan.PlanOpAsArg {
    if (item instanceof AST.ASTVariable) {
      infer(item, args);
      return { op: new plan.FnCall('xquery', [item], ret1) };
    }
    return { op: item.accept(this, args) };
  }
  visitOperator(node: ASTOperator, args: DescentArgs): PlanOperator {
    return new plan.FnCall(
      'xquery',
      node.operands.map((x) => this.processOpArg(x, args)),
      this.db.langMgr.getOp(node.lang, ...idToPair(node.id)).impl,
      true,
    );
  }

  private renameAggSource(
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
  private joinAggArgs(args: PlanTupleOperator[]) {
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

  private prepareAggArg(arg: PlanOperator): PlanTupleOperator {
    if (plan.CalcIntermediate in arg) {
      let calcParams = arg.accept(this.calcBuilders);
      calcParams = simplifyCalcParams(calcParams, this.eqCheckers, 'xquery');

      if (calcParams.literal) {
        const ret = coalesceSeq(calcParams.impl());
        calcParams.impl = () => ret;
      } else {
        calcParams.impl = (...args) => coalesceSeq(calcParams.impl(...args));
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
  visitFunction(node: ASTFunction, dargs: DescentArgs): PlanOperator {
    const [id, schema] = idToPair(node.id);
    let impl: Fn | AggregateFn;
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
        (dot, len, pos, ...args) =>
          impl.impl(...args, {
            item: dot,
            position: pos,
            size: len,
          } as FnContext),
        impl.pure,
      );
    }

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
            impl,
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
