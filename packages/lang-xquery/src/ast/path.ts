import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { ASTItemType, ItemKind } from './item-type.js';
import { ASTVariable } from './expression.js';

export class PathExpr implements ASTNode {
  constructor(
    public steps: ASTNode[],
    public start?: '/' | '//',
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPathExpr(this, arg);
  }
}

export class PathPredicate implements ASTNode {
  constructor(public exprs: ASTNode[]) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPathPredicate(this, arg);
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

  constructor(
    public axis: AxisType,
    public nodeTest: ASTItemType,
  ) {
    if (
      axis !== AxisType.ATTRIBUTE &&
      nodeTest.name !== '*' &&
      !nodeTest.kind
    ) {
      nodeTest.kind = ItemKind.ELEMENT;
    }
  }

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPathAxis(this, arg);
  }
}
