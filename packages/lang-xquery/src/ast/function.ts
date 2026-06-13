import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { ASTVariable } from './expression.js';

/** XQuery inline anonymous function literal: `function($args) { body }`. */
export class InlineFunction implements ASTNode {
  constructor(
    /** The formal parameter variables. */
    public args: ASTVariable[],
    /** The sequence of body expressions. */
    public body: ASTNode[],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitInlineFn(this, arg);
  }
}

/** XQuery dynamic function call where the function reference is resolved at runtime. */
export class DynamicFunctionCall implements ASTNode {
  constructor(
    /** The expression or name that yields the function to call. */
    public nameOrExpr: ASTNode,
    /** The argument expressions passed to the function. */
    public args: ASTNode[] = [],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDynamicFunctionCall(this, arg);
  }
}

/**
 * XQuery partial-application expression that pre-binds selected arguments of a function,
 * e.g. `fn(?, 1)` produces a new single-argument function.
 */
export class BoundFunction implements ASTNode {
  constructor(
    /** The function reference or expression being partially applied. */
    public nameOrExpr: ASTNode,
    /** Pairs of (0-based parameter index, argument expression) for each pre-bound argument. */
    public boundArgs: [number, ASTNode][],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitBoundFunction(this, arg);
  }
}
