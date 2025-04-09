import { Selection } from '../../plan/operators/index.js';
import { PatternRule } from '../rule.js';

export const pushdownSelections: PatternRule<Selection> = {
  operator: Selection,
  match: (node) => {
    return node.source.constructor === Selection;
  },
  transform: (node) => {
    const source = node.source as Selection;
    if (source.source.constructor !== Selection) {
      return node;
    }
    const result = new Selection(node.lang, source.condition, source.source);
    result.schema = node.schema;
    result.schemaSet = node.schemaSet;
    return result;
  },
};
