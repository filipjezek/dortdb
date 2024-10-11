import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';

export class PathExpr implements ASTNode {
  constructor(public steps: ASTNode[], public start?: '/' | '//') {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitPathExpr(this);
  }
}

export class PathPredicate implements ASTNode {
  constructor(public exprs: ASTNode[]) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitPathPredicate(this);
  }
}

export enum AxisType {
  CHILD = 'child',
  DESCENDANT = 'descendant',
  ATTRIBUTE = 'attribute',
  SELF = 'self',
  DESCENDANT_OR_SELF = 'descendant-or-self',
  FOLLOWING_SIBLING = 'following-sibling',
  FOLLOWING = 'following',

  PARENT = 'parent',
  ANCESTOR = 'ancestor',
  PRECEDING_SIBLING = 'preceding-sibling',
  PRECEDING = 'preceding',
  ANCESTOR_OR_SELF = 'ancestor-or-self',
}
export class PathAxis implements ASTNode {
  public predicates: PathPredicate[] = [];

  constructor(public axis: AxisType, public nodeTest: ASTNode) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitPathAxis(this);
  }
}
