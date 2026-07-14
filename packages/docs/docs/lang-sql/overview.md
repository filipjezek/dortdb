---
sidebar_position: 1
title: SQL Overview
description: Query arrays of objects with the DortDB SQL language.
---

# SQL

[`@dortdb/lang-sql`](../api/@dortdb/lang-sql/index.md) adds a PostgreSQL-flavored `SELECT` language to DortDB. It is
the natural choice for **row-shaped data**: arrays of plain JavaScript objects,
where each object is a row and each property is a column.

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
});

db.registerSource(
  ['people'],
  [
    { id: 1, name: 'Alice', city: 'Prague' },
    { id: 2, name: 'Bob', city: 'Ankara' },
    { id: 3, name: 'Carol', city: 'Prague' },
  ],
);

const result = db.query(`
  SELECT city, count(*) AS total
  FROM people
  GROUP BY city
  ORDER BY total DESC
`);
// data: [ { city: 'Prague', total: 2 }, { city: 'Ankara', total: 1 } ]
```

## What it targets

By default SQL reads sources through the [`ObjectDataAdapter`](../api/@dortdb/lang-sql/default-export/classes/ObjectDataAdapter.md), which treats each
element of a registered array as a row and reads columns as object properties.
You can point SQL at differently-shaped data (for example `Map`-backed rows) by
supplying a custom adapter; see
[Data Sources & Adapters](../guides/data-sources-and-adapters.md).

## Result column names

Selected expressions keep their qualifier in the result schema. Selecting
`t1.id` produces a result key `"t1.id"`; use `AS` to control the name:

```ts
db.query('SELECT t1.id AS id, t2.w AS weight FROM t1 JOIN t2 ON t1.id = t2.id');
// keys: id, weight
```

## Learn more

- [SQL Dialect & Restrictions](./dialect.md): supported features, the
  schemaless restrictions, and what is not implemented.
- The API reference for the exported [`SQL`](../api/@dortdb/lang-sql/default-export/functions/SQL.md),
  [`SQLConfig`](../api/@dortdb/lang-sql/default-export/interfaces/SQLConfig.md),
  [`SQLDataAdapter`](../api/@dortdb/lang-sql/default-export/interfaces/SQLDataAdapter.md), and
  [`ObjectDataAdapter`](../api/@dortdb/lang-sql/default-export/classes/ObjectDataAdapter.md) types.
