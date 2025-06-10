import { ASTIdentifier } from '../ast.js';
import { clone } from '../internal-fns/index.js';
import { AggregateCall, Calculation } from '../plan/operators/index.js';
import { OpOrId } from '../plan/visitor.js';

export function getAggregates(items: OpOrId[]): AggregateCall[] {
  const aggs: AggregateCall[] = [];
  for (const item of items) {
    if (item instanceof AggregateCall) {
      aggs.push(item);
    } else if (item instanceof Calculation) {
      aggs.push(...item.aggregates);
    } else if (item instanceof ASTIdentifier && item.aggregate) {
      aggs.push(item.aggregate);
    }
  }
  return aggs.map(clone);
}
