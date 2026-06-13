import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { ASTVariable } from './expression.js';

/** XQuery FLWOR expression containing an ordered sequence of for/let/window/where/group-by/order-by/count/return clauses. */
export class FLWORExpr implements ASTNode {
  constructor(
    /** The ordered list of FLWOR clauses; the last clause must be a {@link FLWORReturn}. */
    public clauses: FLWORClause[],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORExpr(this, arg);
  }
}

/** Union of the iterable-binding clause types that may appear before a {@link FLWORReturn}. */
export type FLWORClause = FLWORFor | FLWORLet | FLWORWindow;

/** XQuery `for` clause iterating over one or more sequences in parallel. */
export class FLWORFor implements ASTNode {
  constructor(
    /** The individual variable bindings declared within this `for` clause. */
    public bindings: FLWORForBinding[],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORFor(this, arg);
  }
}

/** A single variable binding inside a {@link FLWORFor} clause, e.g. `$x in expr at $pos`. */
export class FLWORForBinding implements ASTNode {
  constructor(
    /** The iteration variable bound to each item. */
    public variable: ASTVariable,
    /** The sequence expression being iterated. */
    public expr: ASTNode,
    /** Whether `allowing empty` is specified, preserving empty-sequence bindings. */
    public allowEmpty = false,
    /** Optional positional variable (`at $pos`) holding the 1-based item index. */
    public posVar?: ASTVariable,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORForBinding(this, arg);
  }
}

/** XQuery `let` clause assigning whole sequences to variables. */
export class FLWORLet implements ASTNode {
  constructor(
    /** Pairs of (variable, expression) where the variable is bound to the entire sequence. */
    public bindings: [ASTVariable, ASTNode][],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORLet(this, arg);
  }
}

/** Whether a {@link FLWORWindow} uses a sliding or tumbling windowing strategy. */
export enum WindowType {
  /** Sliding window: a new window starts for each item, potentially overlapping with previous windows. */
  SLIDING = 'sliding',
  /** Tumbling window: non-overlapping windows that partition the sequence exhaustively. */
  TUMBLING = 'tumbling',
}

/** XQuery `for tumbling/sliding window` clause partitioning a sequence into windows. */
export class FLWORWindow implements ASTNode {
  constructor(
    /** Whether the window is sliding or tumbling. */
    public type: WindowType,
    /** The window variable bound to each window's current item. */
    public variable: ASTVariable,
    /** The sequence expression being windowed. */
    public expr: ASTNode,
    /** The start-condition boundary specification. */
    public start: WindowBoundary,
    /** The optional end-condition boundary specification; absent means the window ends at the sequence end. */
    public end?: WindowBoundary,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORWindow(this, arg);
  }
}

/** Start or end boundary condition of a {@link FLWORWindow} clause. */
export class WindowBoundary {
  /** The boolean guard expression evaluated to test whether this boundary is met. */
  public expr: ASTNode;
  /** Whether the `only` keyword is present (applies to end boundaries; prevents re-use of items). */
  public only = false;

  constructor(
    /** The current item variable at the boundary position. */
    public variable?: ASTVariable,
    /** The positional variable holding the 1-based index of the boundary item. */
    public posVar?: ASTVariable,
    /** The variable bound to the item preceding the boundary item. */
    public prevVar?: ASTVariable,
    /** The variable bound to the item following the boundary item. */
    public nextVar?: ASTVariable,
  ) {}
}

/** XQuery `where` clause that filters tuples by a boolean expression. */
export class FLWORWhere implements ASTNode {
  constructor(
    /** The boolean filter expression; tuples for which this is false are discarded. */
    public expr: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORWhere(this, arg);
  }
}

/** XQuery `group by` clause partitioning the tuple stream by grouping-key expressions. */
export class FLWORGroupBy implements ASTNode {
  constructor(
    /** Pairs of (grouping variable, expression) defining the grouping keys. */
    public bindings: [ASTVariable, ASTNode][],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORGroupBy(this, arg);
  }
}

/** XQuery `order by` clause specifying how tuples are sorted. */
export class FLWOROrderBy implements ASTNode {
  constructor(
    /** The ordered list of sort keys. */
    public items: OrderByItem[],
    /** Whether `stable order by` is used, preserving the original order of equal-keyed tuples. */
    public stable = false,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWOROrderBy(this, arg);
  }
}

/** A single sort-key specification within a {@link FLWOROrderBy} clause. */
export class OrderByItem {
  constructor(
    /** The key expression to sort on. */
    public expr: ASTNode,
    /** `true` for ascending order, `false` for descending. */
    public ascending = false,
    /** `true` if empty sequences sort after all other values, `false` for before. */
    public emptyGreatest = false,
  ) {}
}

/** XQuery `count $var` clause binding the current tuple's 1-based position to a variable. */
export class FLWORCount implements ASTNode {
  constructor(
    /** The variable that receives the sequential tuple count. */
    public variable: ASTVariable,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORCount(this, arg);
  }
}

/** XQuery `return` clause producing one output item per tuple from the FLWOR expression. */
export class FLWORReturn implements ASTNode {
  constructor(
    /** The expression evaluated for each tuple to produce the FLWOR result. */
    public expr: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitFLWORReturn(this, arg);
  }
}
