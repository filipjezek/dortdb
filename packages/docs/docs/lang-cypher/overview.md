---
sidebar_position: 1
title: Cypher Overview
description: Query graph data with DortDB's Cypher frontend and the built-in Graphology adapter.
---

# `@dortdb/lang-cypher`

`@dortdb/lang-cypher` adds a Cypher-style graph query frontend to DortDB.

In DortDB's multimodel strategy, Cypher is the graph-native language used when pattern matching and graph traversal are the natural way to express a subproblem.

The default adapter targets Graphology graphs and lets you select the default graph through package configuration.

## Why Cypher In DortDB

Cypher gives DortDB an expressive graph layer for:

- pattern matching over nodes and relationships
- traversal-heavy queries that are awkward in SQL
- graph checks that can be embedded into larger SQL or XQuery-driven workflows

## Quick Setup

```ts
import { MultiDirectedGraph } from 'graphology';
import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';

const graph = new MultiDirectedGraph();

const db = new DortDB({
  mainLang: Cypher({ defaultGraph: 'defaultGraph' }),
});

db.registerSource(['defaultGraph'], graph);
```

The graph can also be selected directly in the query with a `FROM graphName` clause.

## Where It Fits In Multimodel Queries

Cypher is often used either:

- as the main language when output is relationship-driven
- as an embedded `LANG cypher` subquery inside a SQL or XQuery outer query

This allows you to keep graph-specific logic in Cypher while still participating in one shared execution context.

## Main Exported Surface

The generated API documents the public package surface, especially:

- `Cypher(config?)`
- `CypherConfig`
- `CypherLanguage`
- `CypherDataAdapter`
- `GraphologyDataAdapter`
- `ConnectionIndex`
- `CypherFn`
- `AdapterCtxArg`

## Graphology Integration

The built-in adapter expects labels and edge types to be carried in symbol-backed attributes. The package exports `gaNodeOrEdgeId` and `gaLabelsOrType` to make that convention explicit and reusable.

## Scope Notes

The Cypher frontend is practical and integration-focused. It does not currently aim for full Neo4j feature parity; use the API and tests as the source of truth for exact supported behavior.

## Built-in Graph Functions

The Cypher package exports helper functions such as:

- `startNode`
- `endNode`
- `labels`
- `type`

These are adapter-aware and operate against the active graph context.

## Related Pages

- [Cross-language Queries](../cross-language-queries.md)
- [Core Indices](../core/indices.md)
