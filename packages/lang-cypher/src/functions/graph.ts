import { AdapterCtxArg, CypherFn } from '../language/language.js';

export const startNode: CypherFn = {
  name: 'startNode',
  addAdapterCtx: true,
  pure: true,
  impl: (ctx: AdapterCtxArg, e) =>
    ctx.adapter.getEdgeNode(ctx.graph, e, 'source'),
};
export const endNode: CypherFn = {
  name: 'endNode',
  addAdapterCtx: true,
  pure: true,
  impl: (ctx: AdapterCtxArg, e) =>
    ctx.adapter.getEdgeNode(ctx.graph, e, 'target'),
};
