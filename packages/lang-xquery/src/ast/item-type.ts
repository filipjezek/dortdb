import { ASTNode } from '@dortdb/core';
import { ASTName, ASTStringLiteral } from './expression.js';
import { XQueryVisitor } from './visitor.js';

export enum ItemKind {
  ITEM = 'item',
  NODE = 'node',
  TEXT = 'text',
  FUNCTION = 'function',
  COMMENT = 'comment',
  NAMESPACE_NODE = 'namespace-node',
  PROCESSING_INSTRUCTION = 'processing-instruction',
  ATTRIBUTE = 'attribute',
  ELEMENT = 'element',
  DOCUMENT = 'document-node',
  DOCUMENT_ELEMENT = 'document-node element',
  DOCUMENT_SCHEMA_ELEMENT = 'document-node schema-element',
  SCHEMA_ELEMENT = 'schema-element',
  SCHEMA_ATTRIBUTE = 'schema-attribute',
}
export class ASTItemType implements ASTNode {
  constructor(public kind?: ItemKind | null, public name: ASTName | '*' = '*') {
    if (
      this.name instanceof ASTStringLiteral &&
      this.kind !== ItemKind.PROCESSING_INSTRUCTION
    ) {
      throw new Error(
        'Only processing-instruction can have a string literal name'
      );
    }
  }

  accept<T>(visitor: XQueryVisitor<T>): T {
    return visitor.visitItemType(this);
  }
}
