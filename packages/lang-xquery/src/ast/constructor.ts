import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { XQueryIdentifier } from './expression.js';

export class DirectElementConstructor implements ASTNode {
  public content: DirConstrContent;

  constructor(
    public name: XQueryIdentifier,
    public attributes: [XQueryIdentifier, DirConstrContent][],
    content: (ASTNode[] | ASTNode | string)[] = [],
  ) {
    this.content = new DirConstrContent(content);
  }

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDirectElementConstructor(this, arg);
  }
}

export class DirConstrContent implements ASTNode {
  constructor(public content: (ASTNode[] | ASTNode | string)[]) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDirConstrContent(this, arg);
  }
}

export class DirectCommentConstructor implements ASTNode {
  constructor(public content: string) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDirectCommentConstructor(this, arg);
  }
}

export class DirectPIConstructor implements ASTNode {
  constructor(
    public name: string,
    public content: string = null,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDirectPIConstructor(this, arg);
  }
}

export enum ConstructorType {
  TEXT = 'text',
  COMMENT = 'comment',
  NAMESPACE = 'namespace',
  PROCESSING_INSTRUCTION = 'processing-instruction',
  ATTRIBUTE = 'attribute',
  ELEMENT = 'element',
  DOCUMENT = 'document',
}
export class ComputedConstructor implements ASTNode {
  constructor(
    public type: ConstructorType,
    public content: ASTNode[],
    public name?: XQueryIdentifier | ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitComputedConstructor(this, arg);
  }
}
