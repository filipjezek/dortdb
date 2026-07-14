---
sidebar_position: 3
title: Custom Index Types
description: Implement a secondary index or a hash-join index.
---

# Custom Index Types

A secondary index is a class the optimizer can use to speed up lookups and joins.
You pass an index class to [`createIndex`](../../api/@dortdb/core/default-export/classes/DortDB.md#createindex),
and DortDB optimizes accordingly. Implementing your own means satisfying the
[`Index`](../../api/@dortdb/core/default-export/interfaces/Index.md) interface.

## The `Index` interface

An index implements three methods:

- **[`match(expressions)`](../../api/@dortdb/core/default-export/interfaces/Index.md#match)**: given the expressions appearing in a query (e.g. the
  operands of an equality check), decide which ones this index can serve. Return
  the ordered positions it matches, or `null` if it cannot help.
- **[`createAccessor(expressions)`](../../api/@dortdb/core/default-export/interfaces/Index.md#createaccessor)**: for expressions that matched, return a
  [`Calculation`](../../api/@dortdb/core/plan/classes/Calculation.md) that looks up the matching items for given values of those
  expressions.
- **[`reindex(values)`](../../api/@dortdb/core/default-export/interfaces/Index.md#reindex)**: given the source items and the evaluated index-expression
  keys, (re)fill the index's data structure.

```ts
interface Index {
  expressions: Calculation[];
  reindex(values: Iterable<{ value: unknown; keys: unknown[] }>): void;
  match(expressions: IndexMatchInput[], renameMap?: RenameMap): number[] | null;
  createAccessor(expressions: IndexMatchInput[]): Calculation;
}
```

An index does not have to store anything. The [`ConnectionIndex`](../../api/@dortdb/lang-cypher/default-export/classes/ConnectionIndex.md),
for example, keeps no data structure of its own; it recognizes join conditions
between nodes and relationships and resolves the connected elements through the
graph data adapter.

## Hash-join indices

To let an index accelerate joins of non-indexed data (not just point lookups), implement the
[`HashJoinIndex`](../../api/@dortdb/core/default-export/interfaces/HashJoinIndex.md) extensions and register the class in
`executor.hashJoinIndices`:

- a static **[`canIndex(expressions)`](../../api/@dortdb/core/default-export/interfaces/HashJoinIndexStatic.md#canindex)**
  method, analogous to [`match`](../../api/@dortdb/core/default-export/interfaces/Index.md#match), that decides
  whether the index applies to a join's expressions; and
- an **[`allValues()`](../../api/@dortdb/core/default-export/interfaces/HashJoinIndex.md#allvalues)** method that iterates every stored value (needed to
  evaluate full outer joins).

```ts
new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
  executor: { hashJoinIndices: [MapIndex, MyIndex] },
});
```

The built-in [`MapIndex`](../../api/@dortdb/core/default-export/classes/MapIndex.md) is the reference implementation of both roles: a hash
index usable for equality lookups and for equality-based hash joins.
