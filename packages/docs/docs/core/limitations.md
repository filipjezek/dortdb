---
sidebar_position: 4
title: Limitations
description: What DortDB deliberately does not do (yet).
---

# Limitations

DortDB is built for flexibility and small bundle size, and those choices come
with real constraints. Knowing them up front avoids surprises.

## Read-only

DortDB is currently a **read-only** query framework. There are no data-definition
or data-modification statements: no `CREATE`, `INSERT`, `UPDATE`, `SET`, and so
on. To change data, mutate the registered sources directly from JavaScript; the
next query sees the updated values.

## Rule-based optimizer only

The optimizer collects **no statistics** on registered sources, so cost-based
optimization is not feasible. The optimizer is rule-based and, in particular,
**does not reorder joins**, so write joins in a sensible order and add
[indices](../guides/indexing-and-performance.md) on the columns you filter and
join on.

## Single-threaded

JavaScript is single-threaded, and Web Workers generally cannot share in-memory
data without copying it. DortDB therefore runs in a **single thread**, and query
execution is synchronous. (Explicitly sharding sources across Workers is possible
in principle but is not built in. Similarly, an async executor is possible but not implemented.)

## Partial language coverage

None of the provided languages is implemented in full. Beyond the read-only
restriction, some features are simply not implemented yet (for example SQL
`GROUP BY ROLLUP` or window functions), and some are intentionally excluded,
notably static typing and schema validation, which conflict with the schema-free
design. The per-language boundaries are documented in each language's dialect
page: [SQL](../lang-sql/dialect.md), [XQuery](../lang-xquery/dialect.md),
[Cypher](../lang-cypher/dialect.md). Missing functions can usually be supplied as
[extensions](../guides/extending/functions-and-aggregates.md).
