import { ASTIdentifier, UnsupportedError } from '@dortdb/core';
import { ASTItemType, ItemKind } from '../ast/item-type.js';
import { AxisType, PathAxis } from '../ast/path.js';

const typeMap: Partial<Record<ItemKind, number>> = {
  [ItemKind.ATTRIBUTE]: 2, // Node.ATTRIBUTE_NODE,
  [ItemKind.COMMENT]: 8, // Node.COMMENT_NODE,
  [ItemKind.DOCUMENT]: 9, // Node.DOCUMENT_NODE,
  [ItemKind.DOCUMENT_ELEMENT]: 9, // Node.DOCUMENT_NODE,
  [ItemKind.ELEMENT]: 1, // Node.ELEMENT_NODE,
  [ItemKind.PROCESSING_INSTRUCTION]: 7, // Node.PROCESSING_INSTRUCTION_NODE,
  [ItemKind.TEXT]: 3, // Node.TEXT_NODE,
};

export const treeStep = (
  test: ASTItemType,
  axis: AxisType
): ((node: Node) => Node[]) => {
  let filter: NodeFilter;
  if (!test.kind || test.kind === ItemKind.NODE) filter = null;
  else if (!(test.kind in typeMap))
    throw new UnsupportedError(`item kind "${test.kind}" not supported`);
  else if (test.kind === ItemKind.DOCUMENT_ELEMENT) {
  } else {
    filter = (n) =>
      n.nodeType === typeMap[test.kind] &&
      (test.name === '*' || checkNodeName(n, test.name))
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
  }

  return (n) => {
    const doc = n.nodeType === 9 ? (n as Document) : n.ownerDocument;
    const tw = doc.createTreeWalker(doc, NodeFilter.SHOW_ALL, filter);
    tw.currentNode = n;
    const res: Node[] = [];
    if (
      axis === AxisType.SELF ||
      axis === AxisType.DESCENDANT_OR_SELF ||
      axis === AxisType.ANCESTOR_OR_SELF
    ) {
      res.push(n);
      if (axis === AxisType.SELF) return res;
    } else if (axis === AxisType.ATTRIBUTE) {
      return getAttrs(n, test.name);
    }
    return res;
  };
};

function checkNodeName(node: Node, name: ASTIdentifier): boolean {
  return true;
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
}
