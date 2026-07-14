---
sidebar_position: 2
title: SQL Dialect & Restrictions
description: The PostgreSQL-based SQL dialect, its schemaless restrictions, and unsupported features.
---

# SQL Dialect & Restrictions

DortDB's SQL is based on the **PostgreSQL** flavor and covers its data-selection
subset. It also supports several of PostgreSQL's JSON access operators. There is
no data definition or modification (`CREATE`, `INSERT`, `UPDATE`, ...); DortDB
queries data that already exists in memory.

## Notable features

### Lateral joins

A `LATERAL` subquery may reference tables that appear earlier in the `FROM`
clause, so it is re-evaluated for each outer row:

```sql
SELECT t1.id, s.w
FROM t1
JOIN LATERAL (
  SELECT t2.w FROM t2 WHERE t2.id = t1.id
) AS s ON true
```

### `DISTINCT ON`

PostgreSQL's `DISTINCT ON` keeps the first row per distinct value of the given
expressions, rather than deduplicating whole rows:

```sql
SELECT DISTINCT ON (attr1) attr1, attr2
FROM t1
```

### Filtered aggregates

Aggregate arguments can be filtered with a `FILTER` clause, and duplicates
removed with `DISTINCT`. It is also possible to process the values in a specific order with `ORDER BY`:

```sql
SELECT
  count(DISTINCT attr1) AS distinct_count,
  count(x) FILTER (WHERE x % 2 = 0) AS even_count,
  collect(x ORDER BY x) AS ordered_list
FROM t1
```

## Restrictions from the schemaless model

DortDB sources have no declared schema, so SQL queries that would be ambiguous
without one are rejected. The engine must always be able to tell which source a
column comes from.

- **Unqualified columns require a single, non-joined source.** With more than one
  source in scope, referencing a bare column name raises an _ambiguous column
  names_ error, so qualify it (`t1.attr`).
- **Natural joins are disabled** (there is no schema to infer the join columns
  from). Use an explicit `JOIN ... ON ...`.
- **Every `FROM` subquery must have an alias.** `FROM (SELECT ...)` is a parse
  error; write `FROM (SELECT ...) AS s`.
- **`SELECT *` is not supported.** Without a schema there is nothing to reliably
  expand `*` over. It may occasionally return a result, but that behavior is not
  something to rely on, so always list the columns you want explicitly.

:::tip Referring to an outer scope: `nonlocal`
By default an unqualified column belongs to the current `FROM` table. When you
embed SQL inside another language (for example Cypher, which does not prefix
identifiers), prefix a column with the `nonlocal` schema to refer to a value from
the surrounding scope instead of the current table. See
[Cross-language Queries](../guides/cross-language-queries.md).
:::

## Not implemented

The parser may recognize these, but they are rejected during planning or
execution:

- **Window functions** (`... OVER (...)`).
- **`GROUP BY ROLLUP`** and related grouping-set features.
- Static typing / schema-validation features, which are intentionally omitted
  across all DortDB languages.

Only a subset of PostgreSQL's standard functions and operators is implemented.
Missing functions can be supplied as [extensions](../guides/extending/functions-and-aggregates.md);
SQL is one of the languages that also supports user-defined operators.
