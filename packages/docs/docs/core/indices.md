---
sidebar_position: 3
title: Indices
description: Secondary indices in DortDB core and how language packages build on them.
---

# Indices

Indices in DortDB are secondary structures attached to registered sources. They exist to make repeated lookups and optimizer rewrites cheaper.

## Core Abstraction

The shared `Index` interface in `@dortdb/core` defines three essential operations:

- `reindex(values)`: rebuild from source data
- `match(expressions, renameMap)`: decide whether the index can satisfy a query expression
- `createAccessor(expressions)`: expose a calculation that retrieves matching values

The default concrete implementation exported from core is `MapIndex`.

## Creating an Index

```ts
import { DortDB, MapIndex } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';

const db = new DortDB({ mainLang: SQL() });
db.registerSource(['addresses'], addresses);

db.createIndex(['addresses'], ['city'], MapIndex, { mainLang: 'sql' });
```

For item-oriented sources, `createIndex()` also accepts `fromItemKey` so an expression can be normalized against a synthetic item field.

## Language-specific Indices

Language packages can ship specialized indices on top of the shared contract. The Cypher package exports `ConnectionIndex`, which is designed for graph traversal patterns.

## Practical Guidance

Create indices for:

- repeated equality lookups
- graph adjacency or connection checks
- expensive expression-based access patterns that can be normalized once

Avoid premature indexing until you know which shapes dominate your workloads.
