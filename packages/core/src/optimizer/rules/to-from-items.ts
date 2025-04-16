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
    return node.source.constructor === MapToItem ? { bindings: {} } : null;
  },
  transform: (node) => {
    const source = node.source as MapToItem;
    const result = new Projection(
      node.lang,
      [[source.key, node.key]],
      source.source,
    );
    result.schema = node.schema;
    result.schemaSet = node.schemaSet;
    return result;
  },
};
