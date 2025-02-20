import {
  ASTLiteral,
  ASTOperator,
  ASTFunction,
  LangSwitch,
  ASTIdentifier,
  allAttrs,
  ASTNode,
} from '@dortdb/core';
import {
  FnCallWrapper,
  ExistsSubquery,
  QuantifiedExpr,
  ASTParameter,
  PatternComprehension,
  ListComprehension,
  CaseExpr,
  CountAll,
  LabelFilterExpr,
  SubscriptExpr,
  PropLookup,
} from 'src/ast/index.js';
import {
  CypherIdentifier,
  ASTStringLiteral,
  ASTNumberLiteral,
  ASTListLiteral,
  ASTMapLiteral,
  ASTBooleanLiteral,
} from 'src/ast/literal.js';
import { PatternElChain, NodePattern, RelPattern } from 'src/ast/pattern.js';
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
} from 'src/ast/query.js';
import { CypherVisitor } from 'src/ast/visitor.js';

export class ASTDeterministicStringifier implements CypherVisitor<string> {
  constructor() {
    this.processNode = this.processNode.bind(this);
    this.visitSchemaPart = this.visitSchemaPart.bind(this);
  }

  private processNode(x: ASTNode) {
    return x.accept(this);
  }

  private visitSchemaPart(node: string | symbol): string {
    return typeof node === 'symbol'
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
  private addQuotes(str: string, quot: '"' | "'" | '`') {
    return quot + str.replaceAll(quot, quot + quot) + quot;
  }
  visitStringLiteral(node: ASTStringLiteral): string {
    return this.addQuotes(node.value, "'");
  }
  visitNumberLiteral(node: ASTNumberLiteral): string {
    return node.value.toString();
  }
  visitListLiteral(node: ASTListLiteral): string {
    return `[${node.items.map(this.processNode).join(',')}]`;
  }
  visitMapLiteral(node: ASTMapLiteral): string {
    throw new Error('Method not implemented.');
  }
  visitBooleanLiteral(node: ASTBooleanLiteral): string {
    throw new Error('Method not implemented.');
  }
  visitFnCallWrapper(node: FnCallWrapper): string {
    throw new Error('Method not implemented.');
  }
  visitExistsSubquery(node: ExistsSubquery): string {
    throw new Error('Method not implemented.');
  }
  visitQuantifiedExpr(node: QuantifiedExpr): string {
    throw new Error('Method not implemented.');
  }
  visitPatternElChain(node: PatternElChain): string {
    throw new Error('Method not implemented.');
  }
  visitParameter(node: ASTParameter): string {
    throw new Error('Method not implemented.');
  }
  visitNodePattern(node: NodePattern): string {
    throw new Error('Method not implemented.');
  }
  visitRelPattern(node: RelPattern): string {
    throw new Error('Method not implemented.');
  }
  visitPatternComprehension(node: PatternComprehension): string {
    throw new Error('Method not implemented.');
  }
  visitListComprehension(node: ListComprehension): string {
    throw new Error('Method not implemented.');
  }
  visitCaseExpr(node: CaseExpr): string {
    throw new Error('Method not implemented.');
  }
  visitCountAll(node: CountAll): string {
    throw new Error('Method not implemented.');
  }
  visitLabelFilterExpr(node: LabelFilterExpr): string {
    throw new Error('Method not implemented.');
  }
  visitSubscriptExpr(node: SubscriptExpr): string {
    throw new Error('Method not implemented.');
  }
  visitPropLookup(node: PropLookup): string {
    throw new Error('Method not implemented.');
  }
  visitSetOp(node: SetOp): string {
    throw new Error('Method not implemented.');
  }
  visitQuery(node: Query): string {
    throw new Error('Method not implemented.');
  }
  visitMatchClause(node: MatchClause): string {
    throw new Error('Method not implemented.');
  }
  visitUnwindClause(node: UnwindClause): string {
    throw new Error('Method not implemented.');
  }
  visitCreateClause(node: CreateClause): string {
    throw new Error('Method not implemented.');
  }
  visitMergeClause(node: MergeClause): string {
    throw new Error('Method not implemented.');
  }
  visitSetClause(node: SetClause): string {
    throw new Error('Method not implemented.');
  }
  visitSetItem(node: SetItem): string {
    throw new Error('Method not implemented.');
  }
  visitRemoveClause(node: RemoveClause): string {
    throw new Error('Method not implemented.');
  }
  visitRemoveItem(node: RemoveItem): string {
    throw new Error('Method not implemented.');
  }
  visitDeleteClause(node: DeleteClause): string {
    throw new Error('Method not implemented.');
  }
  visitProjectionBody(node: ProjectionBody): string {
    throw new Error('Method not implemented.');
  }
  visitOrderItem(node: OrderItem): string {
    throw new Error('Method not implemented.');
  }
  visitWithClause(node: WithClause): string {
    throw new Error('Method not implemented.');
  }
  visitReturnClause(node: ReturnClause): string {
    throw new Error('Method not implemented.');
  }
  visitLiteral<T>(node: ASTLiteral<T>): string {
    throw new Error('Method not implemented.');
  }
  visitOperator(node: ASTOperator): string {
    throw new Error('Method not implemented.');
  }
  visitFunction(node: ASTFunction): string {
    throw new Error('Method not implemented.');
  }
  visitLangSwitch(node: LangSwitch): string {
    throw new Error('Method not implemented.');
  }
}
