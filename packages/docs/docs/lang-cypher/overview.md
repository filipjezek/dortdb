---
sidebar_position: 1
title: Cypher Overview
description: Query property graphs with DortDB's Cypher-based query language and the Graphology adapter.
---

# Cypher

[`@dortdb/lang-cypher`](../api/@dortdb/lang-cypher/default-export/functions/Cypher.md) adds a Cypher-based query language to DortDB. It is the
language for **property graphs**, data best expressed as nodes connected by
relationships, and it brings Cypher's visual, ASCII-art pattern matching,
including variable-length paths.

Cypher operates on **labeled property graphs**: nodes may carry zero or more
labels, each relationship has exactly one type and a direction, and both nodes
and relationships may hold properties.

## Setup

The default data adapter is backed by [Graphology](https://graphology.github.io/).
Register a graph as a source and point the language at it with `defaultGraph`
or with a `FROM graph` clause:

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { Cypher, gaLabelsOrType } from '@dortdb/lang-cypher';
import { MultiDirectedGraph } from 'graphology';

const db = new DortDB({
  mainLang: Cypher({ defaultGraph: 'social' }),
  optimizer: { rules: defaultRules },
});

const graph = new MultiDirectedGraph();
graph.addNode('alice', {
  [gaLabelsOrType]: ['Person'],
  name: 'Alice',
  age: 30,
});
graph.addNode('bob', { [gaLabelsOrType]: ['Person'], name: 'Bob', age: 20 });
graph.addEdge('alice', 'bob', { [gaLabelsOrType]: 'KNOWS' });

db.registerSource(['social'], graph);
```

:::warning[Labels and types live under a symbol key]
The Graphology adapter expects node **labels** and edge **types** in the
[`gaLabelsOrType`](../api/@dortdb/lang-cypher/default-export/variables/gaLabelsOrType.md) symbol-keyed attribute: `{ [gaLabelsOrType]: ['Person'] }` for
a node, `{ [gaLabelsOrType]: 'KNOWS' }` for a relationship. A plain `labels`
property will not be recognized, and label/type patterns like `(:Person)` or
`-[:KNOWS]-` will silently match nothing. The package also exports helpers to
serialize/deserialize a graph that uses these symbol keys.
:::

## Pattern matching

```ts
// every Person, by name
db.query('MATCH (p:Person) RETURN p.name AS name ORDER BY name');

// filter and project matched values, SQL-style
db.query(`
  MATCH (x)-[]->(y)
  WHERE y.age < 15
  RETURN x.name AS person, y.age AS age
`);

// variable-length path: friends-of-friends up to three hops away
db.query(`
  MATCH ({name: "Alice"})-[:KNOWS *1..3]->(foaf)
  RETURN foaf.name AS name
`);
```

A matched path may visit the same node more than once but cannot reuse the same
relationship twice.

## Learn more

- [Cypher Dialect & Restrictions](./dialect.md): supported subset and what is
  left out.
- [Indexing & Performance](../guides/indexing-and-performance.md): the
  [ConnectionIndex](../api/@dortdb/lang-cypher/default-export/classes/ConnectionIndex.md) for graph traversal.
- The API reference for [`Cypher`](../api/@dortdb/lang-cypher/default-export/functions/Cypher.md),
  [`CypherConfig`](../api/@dortdb/lang-cypher/default-export/interfaces/CypherConfig.md),
  [`GraphologyDataAdapter`](../api/@dortdb/lang-cypher/default-export/classes/GraphologyDataAdapter.md),
  [`gaLabelsOrType`](../api/@dortdb/lang-cypher/default-export/variables/gaLabelsOrType.md), and
  [`ConnectionIndex`](../api/@dortdb/lang-cypher/default-export/classes/ConnectionIndex.md).
