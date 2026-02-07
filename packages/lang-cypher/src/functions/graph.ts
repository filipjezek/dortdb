import { shortcutNulls } from '@dortdb/core/utils';
import { AdapterCtxArg, CypherFn } from '../language/language.js';

export const startNode: CypherFn = {
  name: 'startNode',
  addAdapterCtx: true,
  pure: true,
  impl: shortcutNulls((ctx: AdapterCtxArg, e) =>
    ctx.adapter.getEdgeNode(ctx.graph, e, 'source'),
  ),
};
export const endNode: CypherFn = {
  name: 'endNode',
  addAdapterCtx: true,
  pure: true,
  impl: shortcutNulls((ctx: AdapterCtxArg, e) =>
    ctx.adapter.getEdgeNode(ctx.graph, e, 'target'),
  ),
};
export const labels: CypherFn = {
  name: 'labels',
  addAdapterCtx: true,
  pure: true,
  impl: shortcutNulls((ctx: AdapterCtxArg, n) =>
    ctx.adapter.getLabels(ctx.graph, n),
  ),
};
export const type: CypherFn = {
  name: 'type',
  addAdapterCtx: true,
  pure: true,
  impl: shortcutNulls((ctx: AdapterCtxArg, e) =>
    ctx.adapter.getType(ctx.graph, e),
  ),
};
