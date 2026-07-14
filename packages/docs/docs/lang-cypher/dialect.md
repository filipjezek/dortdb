---
sidebar_position: 2
title: Cypher Dialect & Restrictions
description: The openCypher-based dialect, read-only semantics, and library coverage.
---

# Cypher Dialect & Restrictions

DortDB's graph language is a set of **implementation extensions to Cypher**,
based on the openCypher grammar. DortDB can parse the entire openCypher 9
grammar, but — in keeping with DortDB's data-selection focus — only the read
subset is executed.

:::note[Attribution]
This language is derived from the openCypher grammar and is not approved by the
openCypher Implementers Group; it is best described as _implementation extensions
to Cypher_ rather than as "Cypher" or "openCypher". Cypher® is a registered
trademark of Neo4j, Inc.
:::

## Supported

- The full openCypher 9 grammar parses.
- Node and relationship **pattern matching**, in any direction.
- **Variable-length paths**, e.g. `-[:KNOWS *1..3]->`.
- Post-match processing: `WHERE`, `RETURN`, `ORDER BY`, `SKIP`, `LIMIT`,
  aggregation, and so on.

## No data modification

DortDB does not create or mutate data, so the data-writing clauses are rejected
at planning time even though they parse:

- `CREATE`, `MERGE`
- `SET`, `REMOVE`
- `DELETE`, `DETACH DELETE`

Running one of these produces an _only read operations are supported_ error.

## Standard library

Only a subset of the standard Cypher functions and operators is currently
implemented. When a function you need is missing, provide it yourself as a
[user-defined function or extension](../guides/extending/functions-and-aggregates.md) —
this is the intended way to fill gaps in library coverage.

Custom functions for Cypher can receive a reference to the whole queried graph and
its data adapter. For example, this is how the [`startNode`](../api/@dortdb/lang-cypher/default-export/variables/startNode.md)
function is implemented:

```ts
/** Returns the source node of an edge, or `null` when the edge is `null`. */
export const startNode: CypherFn = {
  name: 'startNode',
  addAdapterCtx: true,
  pure: true,
  impl: shortcutNulls((ctx: AdapterCtxArg, e) =>
    ctx.adapter.getEdgeNode(ctx.graph, e, 'source'),
  ),
};
```

## Selecting the graph

The graph a query runs against is the source named by the language's
`defaultGraph` configuration. Alternatively, use the `FROM graph` clause to
target a different graph.

```cypher
FROM social
MATCH (p:Person)
RETURN p.name AS name
```
