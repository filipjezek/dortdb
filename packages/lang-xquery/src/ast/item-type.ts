import { ASTNode } from '@dortdb/core';
import { XQueryIdentifier, ASTStringLiteral } from './expression.js';
import { XQueryVisitor } from './visitor.js';

/** XQuery/XPath item kind test value used in {@link ASTItemType}. */
export enum ItemKind {
  /** Matches any item (`item()`). */
  ITEM = 'item',
  /** Matches any node (`node()`). */
  NODE = 'node',
  /** Matches a text node (`text()`). */
  TEXT = 'text',
  /** Matches a function item (`function(*)`). */
  FUNCTION = 'function',
  /** Matches a comment node (`comment()`). */
  COMMENT = 'comment',
  /** Matches a namespace node (`namespace-node()`). */
  NAMESPACE_NODE = 'namespace-node',
  /** Matches a processing-instruction node (`processing-instruction()`). */
  PROCESSING_INSTRUCTION = 'processing-instruction',
  /** Matches an attribute node (`attribute()`). */
  ATTRIBUTE = 'attribute',
  /** Matches an element node (`element()`). */
  ELEMENT = 'element',
  /** Matches a document node with no content constraint (`document-node()`). */
  DOCUMENT = 'document-node',
  /** Matches a document node whose content satisfies an element test (`document-node(element(...))`). */
  DOCUMENT_ELEMENT = 'document-node element',
  /** Matches a document node whose content satisfies a schema-element test (`document-node(schema-element(...))`). */
  DOCUMENT_SCHEMA_ELEMENT = 'document-node schema-element',
  /** Matches a schema-validated element node (`schema-element()`). */
  SCHEMA_ELEMENT = 'schema-element',
  /** Matches a schema-validated attribute node (`schema-attribute()`). */
  SCHEMA_ATTRIBUTE = 'schema-attribute',
}

/**
 * XQuery item-type or kind test, e.g. `element(foo)`, `xs:integer`, or `node()`.
 *
 * @throws {Error} If a string-literal name is supplied for any kind other than
 *   `processing-instruction`.
 */
export class ASTItemType implements ASTNode {
  constructor(
    /**
     * The node kind being tested, or `null` for an atomic type (the name carries the type QName).
     * `undefined` means no kind constraint was specified.
     */
    public kind?: ItemKind | null,
    /**
     * The name test applied to candidate nodes; `'*'` matches any name.
     * For `processing-instruction`, this may be an {@link ASTStringLiteral}.
     */
    public name: XQueryIdentifier | '*' = '*',
  ) {
    if (
      this.name instanceof ASTStringLiteral &&
      this.kind !== ItemKind.PROCESSING_INSTRUCTION
    ) {
      throw new Error(
        'Only processing-instruction can have a string literal name',
      );
    }
  }

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitItemType(this, arg);
  }
}
