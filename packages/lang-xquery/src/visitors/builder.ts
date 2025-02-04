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
} from '@dortdb/core';
import { XQueryVisitor } from '../ast/visitor.js';
import * as AST from '../ast/index.js';
import { DOT } from '../utils/dot.js';
import { TreeJoin } from '../plan/tree-join.js';

function ret1<T>(x: T): T {
  return x;
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

export class XQueryLogicalPlanBuilder
  implements XQueryVisitor<LogicalPlanOperator>, LogicalPlanBuilder
{
  private calcBuilders: Record<string, LogicalPlanVisitor<CalculationParams>>;
  private operatorStack: LogicalPlanTupleOperator[] = [];

  constructor(private langMgr: LanguageManager) {
    this.calcBuilders = langMgr.getVisitorMap('calculationBuilder');

    this.toCalc = this.toCalc.bind(this);
    this.processNode = this.processNode.bind(this);
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
    return item instanceof ASTIdentifier ? item : item.accept(this);
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
    }
    return res;
  }
  visitFLWORLet(node: AST.FLWORLet): LogicalPlanOperator {
    let res = this.operatorStack.pop() ?? new operators.NullSource('xquery');
    const attrs: Aliased<ASTIdentifier | operators.Calculation>[] =
      res.schema.map((x) => [x, x] as Aliased);
    for (const [varName, expr] of node.bindings) {
      attrs.push([varName, this.toCalc(expr)] as Aliased<
        ASTIdentifier | operators.Calculation
      >);
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
  visitFLWORGroupBy(node: AST.FLWORGroupBy): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitFLWOROrderBy(node: AST.FLWOROrderBy): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitFLWORCount(node: AST.FLWORCount): LogicalPlanOperator {
    throw new Error('Method not implemented.');
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
    throw new Error('Method not implemented.');
  }
  visitIfExpr(node: AST.IfExpr): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSequenceType(node: AST.ASTSequenceType): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitInstanceOfExpr(node: AST.InstanceOfExpr): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitCastExpr(node: AST.CastExpr): LogicalPlanOperator {
    throw new Error('Method not implemented.');
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
      const temp = first.accept(this);
      res =
        temp instanceof LogicalPlanTupleOperator
          ? temp
          : new operators.MapFromItem('xquery', DOT, temp);
    }

    this.operatorStack.push(res);
    return res;
  }
  private processPathStep(step: ASTNode) {
    if (step === DOT) {
      return this.operatorStack.pop();
    }
    if (step instanceof AST.FilterExpr) {
    } else if (step instanceof AST.PathAxis) {
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
    return res;
  }
  visitPathPredicate(node: AST.PathPredicate): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitPathAxis(node: AST.PathAxis): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitFilterExpr(node: AST.FilterExpr): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitDynamicFunctionCall(node: AST.DynamicFunctionCall): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitSequenceConstructor(node: AST.SequenceConstructor): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitOrderedExpr(node: AST.OrderedExpr): LogicalPlanOperator {
    throw new Error('Method not implemented.');
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
    throw new Error('Method not implemented.');
  }
  visitBoundFunction(node: AST.BoundFunction): LogicalPlanOperator {
    throw new Error('Method not implemented.');
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
    const impl = this.langMgr.getFn(node.lang, id, schema, true);

    // TODO: aggregates?
    return new operators.FnCall(
      node.lang,
      node.args.map(this.processNode),
      impl.impl
    );
  }
  visitLangSwitch(node: LangSwitch): LogicalPlanOperator {
    throw new Error('Method not implemented.');
  }
  visitIdentifier(node: ASTIdentifier): LogicalPlanOperator {
    xx;
    return new operators.FnCall('xquery', [DOT], ret1, true);
  }
}
