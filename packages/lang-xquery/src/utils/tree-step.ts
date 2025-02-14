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
  axis: AxisType
): ((node: Node) => Node[]) => {
  let filter: (node: Node) => number;
  if (!test.kind || test.kind === ItemKind.NODE) filter = null;
  else if (!(test.kind in typeMap))
    throw new UnsupportedError(`item kind "${test.kind}" not supported`);
  else {
    filter = (n) =>
      n.nodeType === typeMap[test.kind] &&
      (test.name === '*' || checkNodeName(n as Element | Attr, test.name))
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
  }

  const filterBool = (x: Node) => filter(x) === NodeFilter.FILTER_ACCEPT;

  return (n) => {
    const doc = n.nodeType === 9 ? (n as Document) : n.ownerDocument;
    const tw = doc.createTreeWalker(
      axis === AxisType.DESCENDANT || axis === AxisType.DESCENDANT_OR_SELF
        ? n
        : doc,
      NodeFilter.SHOW_ALL,
      filter
    );
    tw.currentNode = n;
    const res: Node[] = [];
    if (
      axis === AxisType.SELF ||
      axis === AxisType.DESCENDANT_OR_SELF ||
      axis === AxisType.ANCESTOR_OR_SELF
    ) {
      res.push(n);
      if (axis === AxisType.SELF) return res;
    } else if (axis === AxisType.ATTRIBUTE) return getAttrs(n, test.name);
    else if (axis === AxisType.CHILD)
      return Array.from(n.childNodes).filter(filterBool);
    else if (axis === AxisType.PARENT) {
      return filterBool(n.parentNode) ? [n.parentNode] : [];
    }

    const method = axisMap[axis];
    while (tw[method]()) {
      res.push(tw.currentNode);
    }
    return res;
  };
};

function checkNodeName(node: Element | Attr, name: ASTIdentifier): boolean {
  const id = (name.parts[name.parts.length - 1] as string).toLowerCase();
  const schema = (name.parts[name.parts.length - 2] as string)?.toLowerCase();

  const nodeId = node.localName.toLowerCase();
  const nodePrefix = node.prefix?.toLowerCase();

  if (!schema || schema === '*') return nodeId === id;
  if (id === '*') return nodePrefix === schema;
  return nodeId === id && nodePrefix === schema;
}
function getAttrs(node: Node, name: ASTIdentifier | '*'): any[] {
  if ('attributes' in node) {
    const res = Array.from((node as Element).attributes);
    if (name === '*') return res;
    return res.filter((a) => checkNodeName(a, name as ASTIdentifier));
  } else if (name === '*') {
    return Object.values(node);
  } else if (name.parts.length === 1) {
    return [(node as any)[name.parts[0]]];
  }
  return [];
}
