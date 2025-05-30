import { ASTItemType } from '../ast/item-type.js';
import { AxisType } from '../ast/path.js';
import { treeStep } from './tree-step.js';

export interface XQueryDataAdapter<NodeType = any> {
  isNode(node: unknown): node is NodeType;
  treeStep(test: ASTItemType, axis: AxisType): (node: NodeType) => NodeType[];
  createElement(ns: string, qname: string, content: unknown[]): NodeType;
  createAttribute(ns: string, qname: string, content: string): NodeType;
  createComment(content: string): NodeType;
  createDocument(ns: string, qname: string, content: unknown[]): NodeType;
  createNS(name: string, content: string): NodeType;
  createText(content: string): NodeType;
  createProcInstr(name: string, content: string): NodeType;
  addAttribute(el: NodeType, attr: NodeType): void;
  lookupPrefix(el: NodeType, ns: string): string;
  lookupNSUri(el: NodeType, prefix: string): string;
  atomize(value: unknown): unknown;
}

export class DomDataAdapter implements XQueryDataAdapter<Node> {
  constructor(private doc: Document) {
    this.atomize = this.atomize.bind(this);
  }

  public isNode(node: unknown): node is Node {
    return node instanceof Node;
  }

  public atomize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(this.atomize);
    if (!(value instanceof Node)) return value;
    return value instanceof Element || value instanceof Document
      ? value.textContent
      : value.nodeValue;
  }

  public treeStep = treeStep;

  public createElement(ns: string, qname: string, content: unknown[]): Element {
    const el = this.doc.createElementNS(ns, qname);
    for (const item of content) {
      this.appendItem(el, item);
    }
    return el;
  }

  public createAttribute(ns: string, qname: string, content: string): Attr {
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

  private appendItem(node: Node, item: unknown) {
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
