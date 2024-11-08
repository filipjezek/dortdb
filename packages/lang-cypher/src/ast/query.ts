import { ASTNode } from '@dortdb/core';
import { CypherVisitor } from './visitor.js';
import { PatternElChain } from './pattern.js';
import { ASTIdentifier } from './literal.js';
import { FnCallWrapper, PropLookup } from './expression.js';

export enum SetOpType {
  UNION = 'union',
  UNIONALL = 'unionall',
}

export class SetOp implements ASTNode {
  constructor(public type: SetOpType, public next: Query) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitSetOp(this);
  }
}

export type QueryStatement =
  | MatchClause
  | UnwindClause
  | FnCallWrapper
  | CreateClause
  | MergeClause
  | SetClause;
export class Query implements ASTNode {
  public setOp: SetOp;

  constructor(public statements: QueryStatement[]) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitQuery(this);
  }
}

export class MatchClause implements ASTNode {
  public optional = false;
  constructor(public pattern: PatternElChain[], public where?: ASTNode) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitMatchClause(this);
  }
}

export class UnwindClause implements ASTNode {
  constructor(public expr: ASTNode, public variable: ASTIdentifier) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitUnwindClause(this);
  }
}

export class CreateClause implements ASTNode {
  constructor(public pattern: PatternElChain[]) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitCreateClause(this);
  }
}

export class MergeClause implements ASTNode {
  onCreate: SetItem[] = [];
  onMatch: SetItem[] = [];

  constructor(public pattern: PatternElChain, actions: MergeAction[]) {
    for (const action of actions) {
      if (action.trigger === 'create') {
        this.onCreate.push(...action.set.items);
      } else {
        this.onMatch.push(...action.set.items);
      }
    }
  }

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitMergeClause(this);
  }
}

export class MergeAction {
  constructor(public trigger: 'match' | 'create', public set: SetClause) {}
}

export class SetClause implements ASTNode {
  constructor(public items: SetItem[]) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitSetClause(this);
  }
}

export class SetItem implements ASTNode {
  public add = false;
  constructor(
    public key: ASTIdentifier | PropLookup,
    public value: ASTNode | ASTIdentifier[]
  ) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitSetItem(this);
  }
}

export class RemoveClause implements ASTNode {
  constructor(public items: RemoveItem[]) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitRemoveClause(this);
  }
}

export class RemoveItem implements ASTNode {
  constructor(
    public key: ASTIdentifier | PropLookup,
    public labels?: ASTIdentifier[]
  ) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitRemoveItem(this);
  }
}

export class DeleteClause implements ASTNode {
  constructor(public exprs: ASTNode[], public detach = false) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitDeleteClause(this);
  }
}

export class ProjectionBody implements ASTNode {
  constructor(
    public items: ('*' | ASTNode | [ASTNode, ASTIdentifier])[],
    public order?: OrderItem[],
    public skip?: ASTNode,
    public limit?: ASTNode,
    public distinct = false
  ) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitProjectionBody(this);
  }
}

export class OrderItem implements ASTNode {
  constructor(public expr: ASTNode, public ascending = true) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitOrderItem(this);
  }
}

export class ReturnClause implements ASTNode {
  constructor(public body: ProjectionBody) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitReturnClause(this);
  }
}

export class WithClause implements ASTNode {
  constructor(public body: ProjectionBody, public where?: ASTNode) {}

  accept<T>(visitor: CypherVisitor<T>): T {
    return visitor.visitWithClause(this);
  }
}
