import { ASTIdentifier, UnsupportedError } from '@dortdb/core';
import { ASTItemType, ItemKind } from '../ast/item-type.js';
import { AxisType } from '../ast/path.js';

const typeMap: Partial<Record<ItemKind, number>> = {
  [ItemKind.ATTRIBUTE]: 2, // Node.ATTRIBUTE_NODE,
  [ItemKind.COMMENT]: 8, // Node.COMMENT_NODE,
  [ItemKind.DOCUMENT]: 9, // Node.DOCUMENT_NODE,
  [ItemKind.ELEMENT]: 1, // Node.ELEMENT_NODE,
  [ItemKind.PROCESSING_INSTRUCTION]: 7, // Node.PROCESSING_INSTRUCTION_NODE,
  [ItemKind.TEXT]: 3, // Node.TEXT_NODE,
};
const axisMap = {
  [AxisType.ANCESTOR]: 'parentNode',
  [AxisType.ANCESTOR_OR_SELF]: 'parentNode',
  [AxisType.DESCENDANT]: 'nextNode',
  [AxisType.DESCENDANT_OR_SELF]: 'nextNode',
  [AxisType.FOLLOWING]: 'nextNode',
  [AxisType.FOLLOWING_SIBLING]: 'nextSibling',
  [AxisType.PRECEDING]: 'previousNode',
  [AxisType.PRECEDING_SIBLING]: 'previousSibling',
} as const;

export const treeStep = (
  test: ASTItemType,
  axis: AxisType,
): ((node: Node) => Node[]) => {
  if (test.kind && test.kind !== ItemKind.NODE && !(test.kind in typeMap)) {
    throw new UnsupportedError(`item kind "${test.kind}" not supported`);
  }
  const filter = getTWFilter(test);
  const filterBool = (x: Node) => filter(x) === NodeFilter.FILTER_ACCEPT;

  return (n) => {
    const res: Node[] = [];
    if (
      axis === AxisType.SELF ||
      axis === AxisType.DESCENDANT_OR_SELF ||
      axis === AxisType.ANCESTOR_OR_SELF
    ) {
      res.push(n);
      if (axis === AxisType.SELF) return res;
    } else if (axis === AxisType.ATTRIBUTE) return getAttrs(n, test.name);
    else if (axis === AxisType.CHILD) {
      const children = Array.from(n.childNodes);
      return filter ? children.filter(filterBool) : children;
    } else if (axis === AxisType.PARENT) {
      return !filter || filterBool(n.parentNode) ? [n.parentNode] : [];
    }

    const method = axisMap[axis];
    const doc = n.nodeType === 9 ? (n as Document) : n.ownerDocument;
    const tw = doc.createTreeWalker(
      axis === AxisType.DESCENDANT || axis === AxisType.DESCENDANT_OR_SELF
        ? n
        : doc,
      NodeFilter.SHOW_ALL,
      filter,
    );
    tw.currentNode = n;
    while (tw[method]()) {
      res.push(tw.currentNode);
    }
    return res;
  };
};

function getTWFilter(test: ASTItemType): (n: Node) => number {
  if (test.name === '*') {
    if (!test.kind || test.kind === ItemKind.NODE) {
      return null;
    } else {
      return (n) =>
        n.nodeType === typeMap[test.kind]
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
    }
  } else {
    const id = (test.name.parts.at(-1) as string).toLowerCase();
    const schema = (test.name.parts.at(-2) as string)?.toLowerCase();
    if (!test.kind || test.kind === ItemKind.NODE) {
      return (n) =>
        checkNodeName(n as Element | Attr, id, schema)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
    } else {
      return (n) =>
        n.nodeType === typeMap[test.kind] &&
        checkNodeName(n as Element | Attr, id, schema)
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
    }
  }
}

function checkNodeName(
  node: Element | Attr,
  id: string,
  schema: string,
): boolean {
  const nodeId = node.localName.toLowerCase();
  const nodePrefix = node.prefix?.toLowerCase();

  if (!schema || schema === '*') return nodeId === id;
  if (id === '*') return nodePrefix === schema;
  return nodeId === id && nodePrefix === schema;
}

function getAttrs(node: Node, name: ASTIdentifier | '*'): Node[];
function getAttrs(node: object, name: ASTIdentifier | '*'): unknown[];
function getAttrs(node: Node | object, name: ASTIdentifier | '*'): unknown[] {
  if ('attributes' in node) {
    const res = Array.from((node as Element).attributes);
    if (name === '*') return res;
    const id = (name.parts.at(-1) as string).toLowerCase();
    const schema = (name.parts.at(-2) as string)?.toLowerCase();
    return res.filter((a) => checkNodeName(a, id, schema));
  } else if (name === '*') {
    return Object.values(node);
  } else if (name.parts.length === 1) {
    return [(node as Record<string | symbol, unknown>)[name.parts[0]]];
  }
  return [];
}
