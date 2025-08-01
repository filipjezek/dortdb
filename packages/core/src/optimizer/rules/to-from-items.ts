import { allAttrs } from '../../ast.js';
import { MapFromItem, MapToItem } from '../../plan/operators/conversion.js';
import { Projection } from '../../plan/operators/index.js';
import { PatternRule } from '../rule.js';

export const mergeToFromItems: PatternRule<MapToItem> = {
  operator: MapToItem,
  match: (node) => {
    return node.source.constructor === MapFromItem &&
      node.key.equals((node.source as MapToItem).key)
      ? { bindings: {} }
      : null;
  },
  transform: (node) => {
    const source = node.source as MapFromItem;
    return source.source;
  },
};
export const mergeFromToItems: PatternRule<MapFromItem> = {
  operator: MapFromItem,
  match: (node) => {
    return node.source.constructor === MapToItem &&
      (node.source as MapToItem).key.parts[0] !== allAttrs
      ? { bindings: {} }
      : null;
  },
  transform: (node) => {
    const source = node.source as MapToItem;
    const proj = new Projection(
      node.lang,
      [[source.key, node.key]],
      source.source,
    );
    return proj;
  },
};
