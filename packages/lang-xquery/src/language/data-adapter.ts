import { ASTItemType } from '../ast/item-type.js';
import { AxisType } from '../ast/path.js';
import { xhtml } from '../visitors/builder.js';
import { treeStep } from './tree-step.js';

/**
 * Data adapter for the XQuery language.
 */
export interface XQueryDataAdapter<NodeType = any> {
  /** Is the value a Node? */
  isNode(node: unknown): node is NodeType;
  /**
   * Create an XPath step function.
   * @param test The item test to apply.
   * @param axis The axis to use.
   */
  treeStep(test: ASTItemType, axis: AxisType): (node: NodeType) => NodeType[];
  /**
   * Create an element node.
   * @param ns The namespace URI.
   * @param qname The element name.
   * @param content The child nodes.
   */
  createElement(ns: string, qname: string, content: unknown[]): NodeType;
  /**
   * Create an attribute node.
   * @param ns The namespace URI.
   * @param qname The attribute name.
   * @param content The attribute value.
   */
  createAttribute(ns: string, qname: string, content: string): NodeType;
  /**
   * Create a comment node.
   * @param content The comment content.
   */
  createComment(content: string): NodeType;
  /**
   * Create a document node.
   * @param ns The namespace URI.
   * @param qname The document name.
   * @param content The child nodes.
   */
  createDocument(ns: string, qname: string, content: unknown[]): NodeType;
  /**
   * Create a namespace node.
   * @param name The namespace prefix.
   * @param content The namespace URI.
   */
  createNS(name: string, content: string): NodeType;
  /**
   * Create a text node.
   * @param content The text content.
   */
  createText(content: string): NodeType;
  /**
   * Create a processing instruction node.
   * @param name The processing instruction name.
   * @param content The processing instruction content.
   */
  createProcInstr(name: string, content: string): NodeType;
  /**
   * Add an attribute to an element.
   * @param el The element to add the attribute to.
   * @param attr The attribute to add.
   */
  addAttribute(el: NodeType, attr: NodeType): void;
  /**
   * Lookup the namespace prefix for a given element.
   * @param el The element to look up the prefix for.
   * @param ns The namespace URI.
   */
  lookupPrefix(el: NodeType, ns: string): string;
  /**
   * Lookup the namespace URI for a given element.
   * @param el The element to look up the URI for.
   * @param prefix The namespace prefix.
   */
  lookupNSUri(el: NodeType, prefix: string): string;
  /**
   * Atomize a value.
   * @param value The value to atomize.
   */
  atomize(value: unknown): unknown;
}

/**
 * XQuery data adapter based on DOM. It can also access JavaScript object
 * attributes with the attribute axis.
 */
export class DomDataAdapter implements XQueryDataAdapter<Node> {
  constructor(protected doc: Document) {
    this.atomize = this.atomize.bind(this);
  }

  public isNode(node: unknown): node is Node {
    return node instanceof Node;
  }

  public atomize(value: unknown): unknown {
    if (Array.isArray(value)) {
      if (value.length === 1) return this.atomize(value[0]);
      return value.map(this.atomize);
    }
    if (!(value instanceof Node)) return value;
    return value instanceof Element || value instanceof Document
      ? value.textContent
      : value.nodeValue;
  }

  public treeStep = treeStep;

  public createElement(ns: string, qname: string, content: unknown[]): Element {
    if (ns === xhtml) ns = null;
    const el = this.doc.createElementNS(ns, qname);
    for (const item of content) {
      this.appendItem(el, item);
    }
    return el;
  }

  public createAttribute(ns: string, qname: string, content: string): Attr {
    if (ns === xhtml) ns = null;
    const attr = this.doc.createAttributeNS(ns, qname);
    attr.value = content;
    return attr;
  }

  public createComment(content: string): Comment {
    return this.doc.createComment(content);
  }

  public createDocument(
    ns: string,
    qname: string,
    content: unknown[],
  ): Document | Element {
    const doc = this.doc.implementation.createDocument(ns, qname);
    for (const item of content) {
      this.appendItem(doc, item);
    }
    return doc;
  }

  public createNS(name: string, content: string): Attr {
    const attr = this.doc.createAttributeNS(
      'http://www.w3.org/2000/xmlns/',
      'xmlns:' + name,
    );
    attr.value = content;
    return attr;
  }

  public createText(content: string): Text {
    return this.doc.createTextNode(content);
  }

  public createProcInstr(name: string, content: string): ProcessingInstruction {
    return this.doc.createProcessingInstruction(name, content);
  }

  public lookupPrefix(el: Element | Document, ns: string): string {
    return el.lookupPrefix(ns);
  }
  public lookupNSUri(el: Node, prefix: string): string {
    return el.lookupNamespaceURI(prefix);
  }

  protected appendItem(node: Node, item: unknown) {
    if (item instanceof Attr) {
      (node as Element).setAttributeNodeNS(item);
    } else if (item instanceof Node) {
      node.appendChild(item);
    } else {
      node.appendChild(document.createTextNode(item.toString()));
    }
  }

  public addAttribute(el: Element, attr: Attr): void {
    el.setAttributeNodeNS(attr);
  }
}
