import { Aliased, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { PatternElChain } from './pattern.js';
import { CypherIdentifier } from './literal.js';
import { FnCallWrapper, PropLookup } from './expression.js';

/** Set operation type used to combine the results of two queries. */
export enum SetOpType {
  /** UNION - combines results and eliminates duplicate rows. */
  UNION = 'union',
  /** UNION ALL - combines results preserving duplicate rows. */
  UNIONALL = 'unionall',
}

/** Set operation node linking this query to a subsequent one via UNION or UNION ALL. */
export class SetOp implements ASTNode {
  constructor(
    /** The set operation type. */
    public type: SetOpType,
    /** The next {@link Query} in the chain. */
    public next: Query,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSetOp(this, arg);
  }
}

/** Union of all clause types that may appear as a statement inside a {@link Query}. */
export type QueryStatement =
  | MatchClause
  | UnwindClause
  | FnCallWrapper
  | CreateClause
  | MergeClause
  | SetClause
  | RemoveClause
  | DeleteClause
  | ReturnClause
  | WithClause;

/** A complete Cypher query consisting of an ordered sequence of clauses. */
export class Query implements ASTNode {
  /** Set operation linking this query to the next; null if this is the last query. */
  public setOp: SetOp;
  /** Graph identifier from a USE clause; undefined if absent. */
  public from?: CypherIdentifier;

  constructor(
    /** Ordered sequence of query clauses. */
    public statements: QueryStatement[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitQuery(this, arg);
  }
}

/** A MATCH clause that matches graph patterns against the database. */
export class MatchClause implements ASTNode {
  /** True when OPTIONAL MATCH; unmatched rows produce nulls instead of being filtered out. */
  public optional = false;
  constructor(
    /** One or more path patterns to match. */
    public pattern: PatternElChain[],
    /** Optional WHERE predicate; undefined if absent. */
    public where?: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitMatchClause(this, arg);
  }
}

/** An UNWIND clause that expands a list expression into one row per element. */
export class UnwindClause implements ASTNode {
  constructor(
    /** The list expression to unwind. */
    public expr: ASTNode,
    /** Variable bound to each element in the expanded list. */
    public variable: CypherIdentifier,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitUnwindClause(this, arg);
  }
}

/** A CREATE clause that creates nodes and relationships. */
export class CreateClause implements ASTNode {
  constructor(
    /** Path patterns describing the graph elements to create. */
    public pattern: PatternElChain[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCreateClause(this, arg);
  }
}

/** A MERGE clause that matches a pattern or creates it if not found. */
export class MergeClause implements ASTNode {
  /** SET items applied when the pattern is newly created. */
  onCreate: SetItem[] = [];
  /** SET items applied when the pattern already exists in the graph. */
  onMatch: SetItem[] = [];

  constructor(
    /** The single path pattern to merge. */
    public pattern: PatternElChain,
    actions: MergeAction[],
  ) {
    for (const action of actions) {
      if (action.trigger === 'create') {
        this.onCreate.push(...action.set.items);
      } else {
        this.onMatch.push(...action.set.items);
      }
    }
  }

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitMergeClause(this, arg);
  }
}

/**
 * Intermediate representation of an ON CREATE or ON MATCH action used during
 * parsing; collapsed into {@link MergeClause.onCreate} / {@link MergeClause.onMatch}.
 */
export class MergeAction {
  constructor(
    /** `'create'` for ON CREATE, `'match'` for ON MATCH. */
    public trigger: 'match' | 'create',
    /** The SET clause to apply when the trigger fires. */
    public set: SetClause,
  ) {}
}

/** A SET clause that assigns properties or labels to nodes and relationships. */
export class SetClause implements ASTNode {
  constructor(
    /** The individual set assignments. */
    public items: SetItem[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSetClause(this, arg);
  }
}

/** A single SET assignment target and value. */
export class SetItem implements ASTNode {
  /** True when using `+=` (additive property merge); false for `=` (replacement). */
  public add = false;
  constructor(
    /** Target property path or variable. */
    public key: CypherIdentifier | PropLookup,
    /** Value expression, or a list of labels when assigning labels to a node. */
    public value: ASTNode | CypherIdentifier[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSetItem(this, arg);
  }
}

/** A REMOVE clause that removes properties or labels from nodes and relationships. */
export class RemoveClause implements ASTNode {
  constructor(
    /** The individual remove targets. */
    public items: RemoveItem[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitRemoveClause(this, arg);
  }
}

/** A single REMOVE target - either a property or a set of labels. */
export class RemoveItem implements ASTNode {
  constructor(
    /** The property path or variable to remove from. */
    public key: CypherIdentifier | PropLookup,
    /** Labels to remove; undefined when removing a property rather than labels. */
    public labels?: CypherIdentifier[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitRemoveItem(this, arg);
  }
}

/** A DELETE clause that deletes nodes or relationships. */
export class DeleteClause implements ASTNode {
  constructor(
    /** Expressions evaluating to the nodes or relationships to delete. */
    public exprs: ASTNode[],
    /** True when DETACH DELETE, which removes incident relationships automatically. */
    public detach = false,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDeleteClause(this, arg);
  }
}

/** Shared projection body for RETURN and WITH clauses. */
export class ProjectionBody implements ASTNode {
  constructor(
    /** Projection items: `'*'` wildcard, plain expressions, or aliased expressions. */
    public items: (ASTNode | Aliased<ASTNode> | '*')[],
    /** ORDER BY sort keys; null if no ordering is specified. */
    public order: OrderItem[] = null,
    /** SKIP expression; null if absent. */
    public skip: ASTNode = null,
    /** LIMIT expression; null if absent. */
    public limit: ASTNode = null,
    /** True when the DISTINCT modifier is present. */
    public distinct = false,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitProjectionBody(this, arg);
  }
}

/** A single ORDER BY sort key with direction. */
export class OrderItem implements ASTNode {
  constructor(
    /** The expression to sort by. */
    public expr: ASTNode,
    /** True for ascending (ASC, the default), false for descending (DESC). */
    public ascending = true,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitOrderItem(this, arg);
  }
}

/** A RETURN clause that terminates a query and projects its results. */
export class ReturnClause implements ASTNode {
  constructor(
    /** The projection body containing items, ordering, skip, and limit. */
    public body: ProjectionBody,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitReturnClause(this, arg);
  }
}

/** A WITH clause that projects and passes results between query parts. */
export class WithClause implements ASTNode {
  constructor(
    /** The projection body containing items, ordering, skip, and limit. */
    public body: ProjectionBody,
    /** Optional WHERE filter applied after projection; undefined if absent. */
    public where?: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitWithClause(this, arg);
  }
}
