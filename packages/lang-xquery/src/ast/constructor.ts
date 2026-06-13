import { ASTNode } from '@dortdb/core';
import { XQueryVisitor } from './visitor.js';
import { XQueryIdentifier } from './expression.js';

/** Direct XML element constructor literal, e.g. `<tag attr="val">content</tag>`. */
export class DirectElementConstructor implements ASTNode {
  /** Child content of the element, including text, nested elements, and enclosed expressions. */
  public content: DirConstrContent;

  constructor(
    /** The element name. */
    public name: XQueryIdentifier,
    /** Attribute name-value pairs declared on the element's opening tag. */
    public attributes: [XQueryIdentifier, DirConstrContent][],
    content: (ASTNode[] | ASTNode | string)[] = [],
  ) {
    this.content = new DirConstrContent(content);
  }

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDirectElementConstructor(this, arg);
  }
}

/** Mixed content sequence inside a direct XML constructor, holding text, child nodes, and enclosed expressions. */
export class DirConstrContent implements ASTNode {
  constructor(
    /** The content items: raw strings, single AST nodes, or arrays of AST nodes from enclosed expressions. */
    public content: (ASTNode[] | ASTNode | string)[],
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDirConstrContent(this, arg);
  }
}

/** Direct XML comment constructor literal, e.g. `<!-- text -->`. */
export class DirectCommentConstructor implements ASTNode {
  constructor(
    /** The verbatim comment text (excluding the `<!--` / `-->` delimiters). */
    public content: string,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDirectCommentConstructor(this, arg);
  }
}

/** Direct processing-instruction constructor literal, e.g. `<?target data?>`. */
export class DirectPIConstructor implements ASTNode {
  constructor(
    /** The PI target name. */
    public name: string,
    /** The PI data string, or `null` when no data was provided. */
    public content: string = null,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitDirectPIConstructor(this, arg);
  }
}

/** Kind of XML node produced by a {@link ComputedConstructor}. */
export enum ConstructorType {
  /** Constructs a text node. */
  TEXT = 'text',
  /** Constructs a comment node. */
  COMMENT = 'comment',
  /** Constructs a namespace node. */
  NAMESPACE = 'namespace',
  /** Constructs a processing-instruction node. */
  PROCESSING_INSTRUCTION = 'processing-instruction',
  /** Constructs an attribute node. */
  ATTRIBUTE = 'attribute',
  /** Constructs an element node. */
  ELEMENT = 'element',
  /** Constructs a document node. */
  DOCUMENT = 'document',
}

/** Computed XML node constructor, e.g. `element { name } { content }`. */
export class ComputedConstructor implements ASTNode {
  constructor(
    /** The kind of node to construct. */
    public type: ConstructorType,
    /** Expressions computing the node's content. */
    public content: ASTNode[],
    /** Expression computing the node name, absent for node kinds that have no name (e.g. text, comment). */
    public name?: XQueryIdentifier | ASTNode,
  ) {}

  accept<Ret, Arg>(visitor: XQueryVisitor<Ret, Arg>, arg?: Arg): Ret {
    return visitor.visitComputedConstructor(this, arg);
  }
}
