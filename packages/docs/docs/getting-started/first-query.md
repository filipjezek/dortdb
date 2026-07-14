---
sidebar_position: 2
title: Your First Query
description: Construct a DortDB engine, register a source, and run a query.
---

# Your First Query

This page walks through the three steps every DortDB program follows: construct
the engine, register your data, and query it.

## 1. Construct the engine

You create a [`DortDB`](../api/@dortdb/core/default-export/classes/DortDB.md) instance with a configuration object. Two fields are
required: a **main language** and an **optimizer** configuration.

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
});
```

- **`mainLang`** is the default language used to parse queries. Each provided
  language is a factory function — [`SQL()`](../api/@dortdb/lang-sql/default-export/functions/SQL.md),
  [`Cypher()`](../api/@dortdb/lang-cypher/default-export/functions/Cypher.md),
  [`XQuery()`](../api/@dortdb/lang-xquery/default-export/functions/XQuery.md)
  — that returns a language descriptor. At least one language is required.
- **`optimizer.rules`** is the ordered list of rewrite rules the optimizer
  applies. For tree-shaking reasons the optimizer starts with **no** rules; pass
  the exported [`defaultRules`](../api/@dortdb/core/optimizer/variables/defaultRules.md)
  array to get the recommended, pre-ordered set.

To load more languages, add them to `additionalLangs`:

```ts
import { Cypher } from '@dortdb/lang-cypher';
import { XQuery } from '@dortdb/lang-xquery';

const db = new DortDB({
  mainLang: SQL(),
  additionalLangs: [Cypher({ defaultGraph: 'social' }), XQuery()],
  optimizer: { rules: defaultRules },
});
```

## 2. Register your data

[`registerSource`](../api/@dortdb/core/default-export/classes/DortDB.md#registersource) pairs an in-memory value with a name. It does not copy or
transform the data — it is a constant-time operation.

```ts
const addresses = [
  { customerId: 1, city: 'Istanbul', country: 'Turkey' },
  { customerId: 2, city: 'Ankara', country: 'Turkey' },
  { customerId: 3, city: 'Prague', country: 'Czech Republic' },
  { customerId: 4, city: 'Ankara', country: 'Turkey' },
];

db.registerSource(['addresses'], addresses);
```

The name is an **array of parts**, so sources can be namespaced, e.g.
`db.registerSource(['crm', 'addresses'], addresses)`. How a language interprets
the registered value is up to its [data adapter](../guides/data-sources-and-adapters.md);
the SQL default adapter, for example, treats each array element as a row and each
property as a column.

## 3. Query it

[`db.query()`](../api/@dortdb/core/default-export/classes/DortDB.md#query) parses, plans, optimizes, executes, and materializes the results in
one call:

```ts
const result = db.query(`
  SELECT city, count(*) AS customers
  FROM addresses
  GROUP BY city
  ORDER BY customers DESC
`);

console.log(result.schema);
// ['city', 'customers']

console.log(result.data);
// [
//   { city: 'Ankara', customers: 2 },
//   { city: 'Istanbul', customers: 1 },
//   { city: 'Prague', customers: 1 },
// ]
```

The return value is a [`QueryResult`](../api/@dortdb/core/default-export/interfaces/QueryOptions.md):

- **`data`** — an array of result objects. For tuple-producing queries each
  object maps a result column name to its value.
- **`schema`** — the ordered list of result column names, when the query
  produces tuples.

## Choosing a language per query

When you have loaded more than one language, override the language for a single
query with the `mainLang` option (lower-cased language name):

```ts
db.query(`MATCH (p:Person) RETURN p.name`, { mainLang: 'cypher' });
```

## Next step

Learn the different ways to run a query — including streaming execution and
bound parameters — in [Running Queries](./running-queries.md).
