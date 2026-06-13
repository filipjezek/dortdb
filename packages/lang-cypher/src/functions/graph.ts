import { shortcutNulls } from '@dortdb/core/utils';
import { AdapterCtxArg, CypherFn } from '../language/language.js';

/** Returns the source node of an edge, or `null` when the edge is `null`. */
export const startNode: CypherFn = {
  name: 'startNode',
  addAdapterCtx: true,
  pure: true,
  impl: shortcutNulls((ctx: AdapterCtxArg, e) =>
    ctx.adapter.getEdgeNode(ctx.graph, e, 'source'),
  ),
};
/** Returns the target node of an edge, or `null` when the edge is `null`. */
export const endNode: CypherFn = {
  name: 'endNode',
  addAdapterCtx: true,
  pure: true,
  impl: shortcutNulls((ctx: AdapterCtxArg, e) =>
    ctx.adapter.getEdgeNode(ctx.graph, e, 'target'),
  ),
};
/** Returns the label array of a node, or `null` when the node is `null`. */
export const labels: CypherFn = {
  name: 'labels',
  addAdapterCtx: true,
  pure: true,
  impl: shortcutNulls((ctx: AdapterCtxArg, n) =>
    ctx.adapter.getLabels(ctx.graph, n),
  ),
};
/** Returns the relationship type of an edge, or `null` when the edge is `null`. */
export const type: CypherFn = {
  name: 'type',
  addAdapterCtx: true,
  pure: true,
  impl: shortcutNulls((ctx: AdapterCtxArg, e) =>
    ctx.adapter.getType(ctx.graph, e),
  ),
};
