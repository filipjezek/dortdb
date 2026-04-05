---
sidebar_position: 1
title: SQL Overview
description: Query object-like row data with the DortDB SQL frontend.
---

# `@dortdb/lang-sql`

`@dortdb/lang-sql` adds a PostgreSQL-flavored `SELECT` frontend to DortDB.

In the overall DortDB design, SQL is the default choice for row-shaped, object-backed datasets. It is usually the best entry point when your application data already lives in arrays of JavaScript objects.

## Why SQL In DortDB

SQL gives DortDB a familiar language for:

- projection, filtering, grouping, ordering, and joining over row-like data
- quick analytics over in-memory business objects
- acting as an outer query language that can delegate subproblems to Cypher or XQuery with `LANG` blocks

## What It Targets

The default adapter, `ObjectDataAdapter`, treats each object as a row and each property as a column.

```ts
import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';

const db = new DortDB({ mainLang: SQL() });

db.registerSource(
  ['people'],
  [
    { id: 1, city: 'Prague' },
    { id: 2, city: 'Ankara' },
  ],
);

const result = db.query(
  'SELECT city, count(*) AS total FROM people GROUP BY city',
);
```

## Where It Fits In Multimodel Queries

SQL is often the top-level language when your final output is tabular. Inside that SQL query, you can switch into other frontends for non-tabular work and then come back with scalar or row-like results.

Typical pattern:

- use SQL for the outer aggregation/report structure
- use Cypher for graph traversal subqueries
- use XQuery for XML/tree filtering subqueries

## Exports Worth Knowing

The generated API for this package covers the public surface, especially:

- `SQL(config?)`
- `SQLConfig`
- `SQLLanguage`
- `SQLDataAdapter`
- `ObjectDataAdapter`

## Where SQL Fits Best

Use the SQL package when:

- sources are object arrays or row-shaped records
- your outer query wants joins, grouping, filtering, and ordering
- you want to call into Cypher or XQuery only for specific subproblems

## Scope Notes

The SQL frontend is intentionally practical rather than full PostgreSQL compatibility. Prefer [SQL Dialect Notes](./dialect.md) for feature-specific behavior and current limitations.

## Related Pages

- [SQL Dialect Notes](./dialect.md)
- [Cross-language Queries](../cross-language-queries.md)
