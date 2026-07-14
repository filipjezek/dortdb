---
sidebar_position: 3
title: Indexing & Performance
description: Speed up queries with secondary indices, hash joins, and optimizer tuning.
---

# Indexing & Performance

DortDB executes queries with a lazy, synchronous, single-threaded iterator model
and a **rule-based** optimizer (there are no table statistics, so there is no
cost-based planning). The two levers you have for performance are **secondary
indices** and **optimizer configuration**.

## Secondary indices

[`createIndex`](../api/@dortdb/core/default-export/classes/DortDB.md#createindex) builds an index over one or more expressions of a source:

```ts
import { DortDB, MapIndex } from '@dortdb/core';

db.registerSource(['users'], users);

// index on a column
db.createIndex(['users'], ['age'], MapIndex);

// the indexed expression can be any subquery-free expression
db.createIndex(['users'], ['name[0] + age'], MapIndex);
```

The optimizer uses matching indices automatically. For example, an index on
`age` can turn `WHERE age = 35` into an index lookup. Each index class decides
which expressions it can support, so a given index only applies where it makes
sense (e.g. [`MapIndex`](../api/@dortdb/core/default-export/classes/MapIndex.md) for equality).

Indexed expressions are parsed with the default language. For **item sources**
(such as graph nodes), tell DortDB which identifier stands for the item:

```ts
db.createIndex(['social', 'nodes'], ['x.id'], MapIndex, {
  mainLang: 'cypher',
  fromItemKey: ['x'],
});
```

### Graph traversal: `ConnectionIndex`

[`@dortdb/lang-cypher`](../api/@dortdb/lang-cypher/index.md) ships a specialized [`ConnectionIndex`](../api/@dortdb/lang-cypher/default-export/classes/ConnectionIndex.md)
that stores no data of its own; it detects join conditions between nodes and relationships and resolves connected
edges/nodes through the graph adapter, which accelerates traversal:

```ts
import { ConnectionIndex } from '@dortdb/lang-cypher';

db.createIndex(['social', 'nodes'], [], ConnectionIndex);
```

## Hash joins

An index class can also accelerate joins over non-indexed streams. For example,
[`MapIndex`](../api/@dortdb/core/default-export/classes/MapIndex.md) can speed up
equality joins. Make index classes available to the executor via `hashJoinIndices`:

```ts
const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
  executor: { hashJoinIndices: [MapIndex] },
});
```

When no suitable index is available, joins fall back to a nested-loop join.

## Optimizer configuration

The optimizer applies an **ordered** list of rewrite rules. For tree-shaking, it
starts empty; [`defaultRules`](../api/@dortdb/core/optimizer/variables/defaultRules.md) is the recommended, pre-ordered set:

```ts
import { defaultRules } from '@dortdb/core/optimizer';

new DortDB({ mainLang: SQL(), optimizer: { rules: defaultRules } });
```

The default rules, in order, are: **Unnest Subqueries**, **Merge To/From Items**,
**Pushdown Selections**, **ProjectionConcat → Join**, **Products → Joins**,
**Join Indices**, **Index Scans**, and **Merge Projections**. See
[Optimization](../formalism/optimization.md) for what each one does, with
before/after plans.

Because the order matters and rules are independent, you can reorder them, use a
subset, or disable optimization entirely. You can also change the rules at
runtime:

```ts
import { UnnestSubqueries } from '@dortdb/core/optimizer';

db.optimizer.reconfigure({ rules: [UnnestSubqueries] });
```

:::tip[Experiment in the Showcase]
The [Showcase demo](https://filipjezek.github.io/dortdb/showcase/) lets you toggle and
reorder individual optimizer rules and watch how the logical plan changes, a
quick way to build intuition for what each rule does.
:::

You can also author your own rules for custom operators; see
[Optimizer Rules](../guides/extending/optimizer-rules.md).

## Performance characteristics

DortDB trades peak throughput for flexibility and small bundle size:

- Execution is **interpreted, synchronous, and single-threaded**. It is generally
  competitive on relational/aggregation workloads and slower on deep tree
  traversal.
- Some query shapes are known to be slow, due to the lack of cost-based planning. For example, a query with many
  joins and no indices may be slow because the optimizer cannot reorder them.
