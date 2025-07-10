import {
  ASTLiteral,
  ASTOperator,
  ASTFunction,
  LangSwitch,
  ASTIdentifier,
  allAttrs,
  ASTNode,
  Aliased,
} from '@dortdb/core';
import {
  FnCallWrapper,
  ExistsSubquery,
  QuantifiedExpr,
  PatternComprehension,
  ListComprehension,
  CaseExpr,
  CountAll,
  LabelFilterExpr,
  SubscriptExpr,
  PropLookup,
} from '../ast/index.js';
import {
  CypherIdentifier,
  ASTStringLiteral,
  ASTNumberLiteral,
  ASTListLiteral,
  ASTMapLiteral,
  ASTBooleanLiteral,
} from '../ast/literal.js';
import { PatternElChain, NodePattern, RelPattern } from '../ast/pattern.js';
import {
  SetOp,
  Query,
  MatchClause,
  UnwindClause,
  CreateClause,
  MergeClause,
  SetClause,
  SetItem,
  RemoveClause,
  RemoveItem,
  DeleteClause,
  ProjectionBody,
  OrderItem,
  WithClause,
  ReturnClause,
} from '../ast/query.js';
import { CypherVisitor } from '../ast/visitor.js';

export class ASTDeterministicStringifier implements CypherVisitor<string> {
  protected uniqueId = 0;

  constructor() {
    this.processNode = this.processNode.bind(this);
    this.visitSchemaPart = this.visitSchemaPart.bind(this);
    this.processAttr = this.processAttr.bind(this);
    this.processNodeOrAttr = this.processNodeOrAttr.bind(this);
  }

  protected processNode(x: ASTNode) {
    return x.accept(this);
  }
  protected processNodeOrAttr(x: ASTNode | Aliased<ASTNode> | '*') {
    return x === '*'
      ? x
      : x instanceof Array
        ? this.processAttr(x)
        : this.processNode(x);
  }
  protected processAttr(x: Aliased<ASTNode>) {
    return `${x[0].accept(this)} AS ${x[1].accept(this)}`;
  }

  protected visitSchemaPart(node: string | symbol | number): string {
    return typeof node === 'symbol' || typeof node === 'number'
      ? node === allAttrs
        ? '*'
        : node.toString()
      : this.addQuotes(node, '`');
  }
  visitIdentifier(node: ASTIdentifier): string {
    const id = node.parts.map(this.visitSchemaPart).join('.');
    return id;
  }
  visitCypherIdentifier(node: CypherIdentifier): string {
    return this.visitIdentifier(node);
  }
  protected addQuotes(str: string, quot: '"' | "'" | '`') {
    return quot + str.replaceAll(quot, quot + quot) + quot;
  }
  visitStringLiteral(node: ASTStringLiteral): string {
    return this.addQuotes(node.value, "'");
  }
  visitNumberLiteral(node: ASTNumberLiteral): string {
    return node.value.toString();
  }
  visitListLiteral(node: ASTListLiteral): string {
    return `[${node.items.map(this.processNode)}]`;
  }
  visitMapLiteral(node: ASTMapLiteral): string {
    const entries = node.items.map(
      ([v, k]) => `${k.accept(this)}: ${v.accept(this)}`,
    );
    return `{${entries}}`;
  }
  visitBooleanLiteral(node: ASTBooleanLiteral): string {
    return node?.toString() ?? 'null';
  }
  visitFnCallWrapper(node: FnCallWrapper): string {
    let res = node.fn.id.accept(this) + '(';
    if (node.distinct) res += 'DISTINCT ';
    res += node.fn.args.map(this.processNode);
    res += ')';
    if (node.yieldItems) {
      res += 'YIELD ';
      if (node.yieldItems === '*') res += '*';
      else {
        res += node.yieldItems.map(this.processNodeOrAttr);
      }
    }
    if (node.where) res += ' WHERE ' + node.where.accept(this);
    return res;
  }
  visitExistsSubquery(node: ExistsSubquery): string {
    return `EXISTS {${node.query.accept(this)}}`;
  }
  visitQuantifiedExpr(node: QuantifiedExpr): string {
    let res = `${node.quantifier} (${node.variable.accept(this)} IN ${node.expr.accept(this)}`;
    if (node.where) res += ' WHERE ' + node.where.accept(this);
    return res + ')';
  }
  visitPatternElChain(node: PatternElChain): string {
    let chain = node.chain.map(this.processNode).join('');
    if (node.variable) chain = node.variable.accept(this) + '=' + chain;
    return chain;
  }
  visitNodePattern(node: NodePattern): string {
    let res = '(';
    if (node.variable) res += node.variable.accept(this);
    if (node.labels.length)
      res += ':' + node.labels.map(this.processNode).join(':');
    if (node.props) res += ' ' + node.props.accept(this);
    return res + ')';
  }

  protected visitRange(
    range: [ASTNode | undefined, ASTNode | undefined] | [ASTNode | undefined],
  ) {
    const [start, end] = range;
    const res = start ? start.accept(this) : '';
    return range.length === 2
      ? res + '..' + (end ? end.accept(this) : '')
      : res;
  }
  visitRelPattern(node: RelPattern): string {
    let res = '-[';
    if (node.pointsLeft) res = '<' + res;
    if (node.variable) res += node.variable.accept(this);
    if (node.types.length)
      res += ':' + node.types.map(this.processNode).join(':');
    if (node.range) {
      res += '*' + this.visitRange(node.range);
    }
    res += node.range.map((x) => (x ? this.processNode(x) : '')).join('..');
    if (node.props) res += ' ' + node.props.accept(this);
    return res + (node.pointsRight ? ']->' : ']-');
  }
  visitPatternComprehension(node: PatternComprehension): string {
    let res = '[' + node.pattern.accept(this);
    if (node.where) res += ' WHERE ' + node.where.accept(this);
    res += ' | ' + node.expr.accept(this) + ']';
    return res;
  }
  visitListComprehension(node: ListComprehension): string {
    let res = '[' + node.expr.accept(this) + ' IN ' + node.source.accept(this);
    if (node.where) res += ' WHERE ' + node.where.accept(this);
    if (node.expr) res += ' | ' + node.expr.accept(this);
    return res + ']';
  }
  visitCaseExpr(node: CaseExpr): string {
    return `CASE ${node.expr?.accept(this) ?? ''} ${node.whenThens
      .map(([w, t]) => `WHEN ${w.accept(this)} THEN ${t.accept(this)}`)
      .join(' ')} ${
      node.elseExpr ? ' ELSE ' + node.elseExpr.accept(this) : ''
    } END`;
  }
  visitCountAll(node: CountAll): string {
    return 'COUNT(*)';
  }
  visitLabelFilterExpr(node: LabelFilterExpr): string {
    return `${node.expr.accept(this)}:${node.labels.map(this.processNode).join(':')}`;
  }
  visitSubscriptExpr(node: SubscriptExpr): string {
    return node.expr.accept(this) + '[' + this.visitRange(node.subscript) + ']';
  }
  visitPropLookup(node: PropLookup): string {
    return node.expr.accept(this) + '.' + node.prop.accept(this);
  }
  visitSetOp(node: SetOp): string {
    return node.type + ' ' + node.next.accept(this);
  }
  visitQuery(node: Query): string {
    let res = node.from ? 'FROM ' + node.from.accept(this) : '';
    for (const s of node.statements) {
      res += ' ' + s.accept(this);
    }
    if (node.setOp) res += ' ' + node.setOp.accept(this);
    return res;
  }
  visitMatchClause(node: MatchClause): string {
    let res = 'MATCH ' + node.pattern.map(this.processNode);
    if (node.where) res += ' WHERE ' + node.where.accept(this);
    if (node.optional) res = 'OPTIONAL ' + res;
    return res;
  }
  visitUnwindClause(node: UnwindClause): string {
    return `UNWIND ${node.expr.accept(this)} AS ${node.variable.accept(this)}`;
  }
  visitCreateClause(node: CreateClause): string {
    return `CREATE ${node.pattern.map(this.processNode)}`;
  }
  visitMergeClause(node: MergeClause): string {
    let res = 'MERGE ' + this.visitPatternElChain(node.pattern);
    if (node.onMatch)
      res += ' ON MATCH SET ' + node.onMatch.map(this.processNode);
    if (node.onCreate)
      res += ' ON CREATE SET ' + node.onCreate.map(this.processNode);
    return res;
  }
  visitSetClause(node: SetClause): string {
    return 'SET ' + node.items.map(this.processNode);
  }
  visitSetItem(node: SetItem): string {
    let res = node.key.accept(this);
    if (Array.isArray(node.value))
      return res + ':' + node.value.map(this.processNode).join(':');
    res += node.add ? '+=' : '=';
    return res + node.value.accept(this);
  }
  visitRemoveClause(node: RemoveClause): string {
    return 'REMOVE ' + node.items.map(this.processNode);
  }
  visitRemoveItem(node: RemoveItem): string {
    let res = node.key.accept(this);
    if (node.labels?.length) {
      res += ':' + node.labels.map(this.processNode).join(':');
    }
    return res;
  }
  visitDeleteClause(node: DeleteClause): string {
    const res = 'DELETE ' + node.exprs.map(this.processNode);
    return node.detach ? ' DETACH ' + res : res;
  }
  visitProjectionBody(node: ProjectionBody): string {
    let res =
      node.items === '*'
        ? '*'
        : node.items.map(this.processNodeOrAttr).join(',');
    if (node.distinct) res = 'DISTINCT ' + res;
    if (node.order) res += ' ORDER BY ' + node.order.map(this.processNode);
    if (node.skip) res += ' SKIP ' + node.skip.accept(this);
    if (node.limit) res += ' LIMIT ' + node.limit.accept(this);
    return res;
  }
  visitOrderItem(node: OrderItem): string {
    return node.expr.accept(this) + (node.ascending ? '' : ' DESC');
  }
  visitWithClause(node: WithClause): string {
    const res = `WITH ${this.visitProjectionBody(node.body)}`;
    return node.where ? res + ' WHERE ' + node.where.accept(this) : res;
  }
  visitReturnClause(node: ReturnClause): string {
    return 'RETURN ' + this.visitProjectionBody(node.body);
  }
  visitLiteral<T>(node: ASTLiteral<T>): string {
    throw new Error('Method not implemented.');
  }
  visitOperator(node: ASTOperator): string {
    return `${node.id.accept(this)}(${node.operands.map(this.processNode)})`;
  }
  visitFunction(node: ASTFunction): string {
    throw new Error('Method not implemented.');
  }
  visitLangSwitch(node: LangSwitch): string {
    return `lang_${node.lang}_${this.uniqueId++}`;
  }
}
