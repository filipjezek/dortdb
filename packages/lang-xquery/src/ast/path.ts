import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { ASTItemType, ItemKind } from './item-type.js';

/** XPath path expression composed of a sequence of steps, e.g. `/a/b[c]/d`. */
export class PathExpr implements ASTNode {
  constructor(
    /** The ordered path steps (axis steps, filter expressions, etc.). */
    public steps: ASTNode[],
    /**
     * Whether the path is anchored: `'/'` for an absolute path from the document root,
     * `'//'` for an abbreviated absolute descendant path, or absent for a relative path.
     */
    public start?: '/' | '//',
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPathExpr(this, arg);
  }
}

/** XQuery simple map expression `source ! mapping`, applying `mapping` to each item of `source`. */
export class SimpleMapExpr implements ASTNode {
  constructor(
    /** The left-hand sequence expression supplying the context items. */
    public source: ASTNode,
    /** The expression evaluated once per context item. */
    public mapping: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSimpleMapExpr(this, arg);
  }
}

/** A predicate list `[expr]` attached to a path step or filter expression. */
export class PathPredicate implements ASTNode {
  constructor(
    /** The predicate expressions; multiple predicates within the same bracket pair are ANDed. */
    public exprs: ASTNode[],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitPathPredicate(this, arg);
  }
}

/** XPath axis specifying the tree traversal direction relative to the context node. */
export enum AxisType {
  /** Forward axis selecting direct children of the context node. */
  CHILD = 'child',
  /** Forward axis selecting all descendants of the context node. */
  DESCENDANT = 'descendant',
  /** Forward axis selecting attributes of the context node. */
  ATTRIBUTE = 'attribute',
  /** Axis selecting the context node itself. */
  SELF = 'self',
  /** Forward axis selecting the context node and all its descendants. */
  DESCENDANT_OR_SELF = 'descendant-or-self',
  /** Forward axis selecting following siblings of the context node. */
  FOLLOWING_SIBLING = 'following-sibling',
  /** Forward axis selecting all nodes following the context node in document order, excluding descendants. */
  FOLLOWING = 'following',
  /** Reverse axis selecting the parent of the context node. */
  PARENT = 'parent',
  /** Reverse axis selecting all ancestors of the context node. */
  ANCESTOR = 'ancestor',
  /** Reverse axis selecting preceding siblings of the context node. */
  PRECEDING_SIBLING = 'preceding-sibling',
  /** Reverse axis selecting all nodes preceding the context node in document order, excluding ancestors. */
  PRECEDING = 'preceding',
  /** Reverse axis selecting the context node and all its ancestors. */
  ANCESTOR_OR_SELF = 'ancestor-or-self',
}

/**
 * A single path step combining an axis, a node test, and zero or more predicates,
 * e.g. `child::element(foo)[predicate]`.
 *
 * @remarks When the axis is not `attribute` and the node test has a name but no explicit kind,
 * the constructor defaults the kind to {@link ItemKind.ELEMENT}.
 */
export class PathAxis implements ASTNode {
  /** Filter predicates applied to each candidate node after the node test. */
  public predicates: PathPredicate[] = [];

  constructor(
    /** The traversal axis. */
    public axis: AxisType,
    /** The item-type node test that candidate nodes must satisfy. */
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
