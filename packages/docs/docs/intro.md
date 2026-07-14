---
sidebar_position: 0
title: Introduction
description: A modular, multi-language query engine for in-memory JavaScript data.
---

# Introduction

DortDB is a TypeScript framework for querying data that already lives in your
application's memory. Instead of moving arrays, DOM trees, or graphs into a
separate database process, you register them as they are and query them in
place.

DortDB is not tied to any single query language. The engine is a small,
language-neutral core, and **query languages are plug-ins**. Every language
compiles to the same [unified algebra](./formalism/algebra.md), which is what
lets a single query mix languages and lets the optimizer reason across the whole
plan.

Three languages are provided out of the box, one for each major data model:

| Package                                            | Language | Best for                            |
| -------------------------------------------------- | -------- | ----------------------------------- |
| [`@dortdb/lang-sql`](./lang-sql/overview.md)       | SQL      | arrays of objects / row-shaped data |
| [`@dortdb/lang-cypher`](./lang-cypher/overview.md) | Cypher   | property graphs                     |
| [`@dortdb/lang-xquery`](./lang-xquery/overview.md) | XQuery   | XML, DOM, and tree-shaped data      |

You choose which languages to load, and you can add your own — the three
provided packages are consumers of the same public extension points that are
available to you.

## Why DortDB

DortDB is built around a few deliberate design principles (covered in depth in
[Design Principles](./core/design-principles.md)):

- **Language neutrality.** No language is privileged. Any language can be the
  outer language, and any language can be nested inside another.
- **Schema agnosticism.** Sources are plain in-memory values. There is no schema
  to declare and no import step — registering a source is an $O(1)$ operation.
- **A shared algebra as the compilation target.** Every language lowers to one
  operator algebra, so cross-language queries are optimized and executed as a
  single plan rather than as opaque nested calls.
- **Modularity.** The core, each language, and each extension is a separate
  package, so you bundle only what you use.

## Installation

Install the core plus whichever language packages you need:

```bash npm2yarn
npm install @dortdb/core @dortdb/lang-sql
# add more languages when you need them
npm install @dortdb/lang-cypher @dortdb/lang-xquery graphology
```

[`Graphology`](https://npmx.dev/package/graphology) is a peer dependency only of the Cypher package (it backs the
default graph adapter). See [Installation](./getting-started/installation.md) for
details.

## First query

The smallest useful setup is SQL over an array of objects:

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
});

const addresses = [
  { customerId: 1, city: 'Istanbul', country: 'Turkey' },
  { customerId: 2, city: 'Ankara', country: 'Turkey' },
  { customerId: 3, city: 'Prague', country: 'Czech Republic' },
  { customerId: 4, city: 'Ankara', country: 'Turkey' },
];

// registering a source just pairs data with a name — no copying, no import
db.registerSource(['addresses'], addresses);

const result = db.query(`
  SELECT city, count(*) AS customers
  FROM addresses
  GROUP BY city
  ORDER BY customers DESC
`);

result.schema; // ['city', 'customers']
result.data;
// [
//   { city: 'Ankara', customers: 2 },
//   { city: 'Istanbul', customers: 1 },
//   { city: 'Prague', customers: 1 },
// ]
```

[`db.query()`](./api/@dortdb/core/default-export/classes/DortDB#query)
materializes the results into an array. When you want streaming results or
control over the intermediate plan, use [`parse`](./api/@dortdb/core/default-export/classes/DortDB#parse),
[`buildPlan`](./api/@dortdb/core/default-export/classes/DortDB#buildplan), and
[`executePlan`](./api/@dortdb/core/default-export/classes/DortDB#executeplan)
instead — see [Running Queries](./getting-started/running-queries.md).

## Mixing languages

The distinctive feature of DortDB is not just supporting several languages, but
**embedding one inside another**. A query switches languages with a `LANG`
block, and the inner query can still reference values from the surrounding
scope:

```ts
const db = new DortDB({
  mainLang: SQL(),
  additionalLangs: [XQuery()],
  optimizer: { rules: defaultRules },
});

db.query(`
  SELECT name, age
  FROM users
  WHERE age > 30 AND (
    LANG xquery
    fn:count($invoices/customer[. = $users:name])
  ) > 5
`);
```

See [Cross-language Queries](./guides/cross-language-queries.md) for the syntax,
scope rules, and patterns.

## Scope and status

DortDB focuses on **querying data that is already loaded** — it is not a
persistent DBMS and does not handle data modification or storage. The provided
SQL, XQuery, and Cypher implementations cover the data-selection subset of each
language rather than the full specification; the exact boundaries are documented
per language and summarized in [Limitations](./core/limitations.md).

## Where to next

1. [Getting Started](./getting-started/installation.md) — install, configure,
   and run your first queries.
2. Language reference — [SQL](./lang-sql/overview.md),
   [Cypher](./lang-cypher/overview.md), [XQuery](./lang-xquery/overview.md).
3. [Cross-language Queries](./guides/cross-language-queries.md),
   [Data Sources & Adapters](./guides/data-sources-and-adapters.md), and
   [Indexing & Performance](./guides/indexing-and-performance.md).
4. [Core Concepts](./core/architecture.md) and the [Formalism](./formalism/overview.md)
   behind the engine.
5. [Extending DortDB](./guides/extending/overview.md) — add languages, functions,
   indices, and optimizer rules.
6. [API Reference](./api/index.md) for exact, generated type signatures.
