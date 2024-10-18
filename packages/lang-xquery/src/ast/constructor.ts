import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { ASTName } from './expression.js';

export class DirectElementConstructor implements ASTNode {
  public content: DirConstrContent;

  constructor(
    public name: ASTName,
    public attributes: [ASTName, DirConstrContent][],
    content: (ASTNode[] | ASTNode | string)[] = []
  ) {
    this.content = new DirConstrContent(content);
  }

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitDirectElementConstructor(this);
  }
}

export class DirConstrContent implements ASTNode {
  constructor(public content: (ASTNode[] | ASTNode | string)[]) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitDirConstrContent(this);
  }
}

export class DirectCommentConstructor implements ASTNode {
  constructor(public content: string) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitDirectCommentConstructor(this);
  }
}

export class DirectPIConstructor implements ASTNode {
  constructor(public name: string, public content?: string) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitDirectPIConstructor(this);
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
    public name?: ASTName | ASTNode
  ) {}

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitComputedConstructor(this);
  }
}
