import { Aliased, ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { PatternElChain } from './pattern.js';
import { CypherIdentifier } from './literal.js';
import { FnCallWrapper, PropLookup } from './expression.js';

export enum SetOpType {
  UNION = 'union',
  UNIONALL = 'unionall',
}

export class SetOp implements ASTNode {
  constructor(
    public type: SetOpType,
    public next: Query,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSetOp(this, arg);
  }
}

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

export class Query implements ASTNode {
  public setOp: SetOp;
  public from?: CypherIdentifier;

  constructor(public statements: QueryStatement[]) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitQuery(this, arg);
  }
}

export class MatchClause implements ASTNode {
  public optional = false;
  constructor(
    public pattern: PatternElChain[],
    public where?: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitMatchClause(this, arg);
  }
}

export class UnwindClause implements ASTNode {
  constructor(
    public expr: ASTNode,
    public variable: CypherIdentifier,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitUnwindClause(this, arg);
  }
}

export class CreateClause implements ASTNode {
  constructor(public pattern: PatternElChain[]) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitCreateClause(this, arg);
  }
}

export class MergeClause implements ASTNode {
  onCreate: SetItem[] = [];
  onMatch: SetItem[] = [];

  constructor(
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

export class MergeAction {
  constructor(
    public trigger: 'match' | 'create',
    public set: SetClause,
  ) {}
}

export class SetClause implements ASTNode {
  constructor(public items: SetItem[]) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSetClause(this, arg);
  }
}

export class SetItem implements ASTNode {
  public add = false;
  constructor(
    public key: CypherIdentifier | PropLookup,
    public value: ASTNode | CypherIdentifier[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitSetItem(this, arg);
  }
}

export class RemoveClause implements ASTNode {
  constructor(public items: RemoveItem[]) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitRemoveClause(this, arg);
  }
}

export class RemoveItem implements ASTNode {
  constructor(
    public key: CypherIdentifier | PropLookup,
    public labels?: CypherIdentifier[],
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitRemoveItem(this, arg);
  }
}

export class DeleteClause implements ASTNode {
  constructor(
    public exprs: ASTNode[],
    public detach = false,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDeleteClause(this, arg);
  }
}

export class ProjectionBody implements ASTNode {
  constructor(
    public items: (ASTNode | Aliased<ASTNode>)[] | '*',
    public order?: OrderItem[],
    public skip?: ASTNode,
    public limit?: ASTNode,
    public distinct = false,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitProjectionBody(this, arg);
  }
}

export class OrderItem implements ASTNode {
  constructor(
    public expr: ASTNode,
    public ascending = true,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitOrderItem(this, arg);
  }
}

export class ReturnClause implements ASTNode {
  constructor(public body: ProjectionBody) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitReturnClause(this, arg);
  }
}

export class WithClause implements ASTNode {
  constructor(
    public body: ProjectionBody,
    public where?: ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: CypherVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitWithClause(this, arg);
  }
}
