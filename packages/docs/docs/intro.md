---
sidebar_position: 1
title: Introduction
description: Browser-first multimodel query engine for JavaScript and TypeScript.
---

# DortDB

DortDB is a TypeScript in-memory query engine for existing application data. It is designed for browser and JavaScript runtime environments where data already lives in memory and where you want expressive querying without moving data into a separate database process.

The project is intentionally modular. The core package owns parsing flow, planning, optimization, execution, and extension points. Language packages plug into that core and provide SQL, XQuery, and Cypher frontends.

Use DortDB when you want to:

- query plain JavaScript objects with SQL
- query XML or DOM-like trees with XQuery
- query graph data with Cypher
- combine those models inside one runtime and one logical plan
- keep bundle size under control by importing only the components you need

## Why DortDB

DortDB is built around five practical goals:

- browser-first operation on in-memory JavaScript data
- modular architecture with tree-shaking-friendly package boundaries
- multi-language querying instead of a single monolithic "universal" language
- extensibility through language, function, operator, and index interfaces
- competitive execution through plan optimization and secondary indices

These goals come directly from the thesis design constraints and drive most architecture decisions.

## Package Layout

- `@dortdb/core`: the engine, optimizer hooks, extensions, and index abstractions
- `@dortdb/lang-sql`: SQL parser and executor for object-like row data
- `@dortdb/lang-xquery`: XQuery parser and executor for XML, DOM, and tree-shaped values
- `@dortdb/lang-cypher`: Cypher parser and executor for graph data, with a Graphology adapter out of the box

The narrative guides in this section explain how these pieces fit together. The `API` navbar section is generated from the exported TypeScript surface of these packages.

## Installation

Install the core package and the language package you plan to use.

```bash
npm install @dortdb/core @dortdb/lang-sql
```

Add the other frontends when you need them.

```bash
npm install @dortdb/lang-cypher @dortdb/lang-xquery graphology
```

## First Query

The smallest useful setup uses SQL over an array of objects.

```ts
import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';

const addresses = [
  { customerId: 1, city: 'Istanbul', country: 'Turkey' },
  { customerId: 2, city: 'Ankara', country: 'Turkey' },
  { customerId: 3, city: 'Prague', country: 'Czech Republic' },
  { customerId: 4, city: 'Ankara', country: 'Turkey' },
];

const db = new DortDB({
  mainLang: SQL(),
});

db.registerSource(['addresses'], addresses);

const result = db.query(`
  SELECT city, count(*) AS customers
  FROM addresses
  GROUP BY city
  ORDER BY customers DESC
`);

console.log(result.data);
console.log(result.schema);
```

`db.query()` materializes results into arrays. When you need streaming behavior instead, build a plan and execute it with `executePlan()`.

## Mixing Languages

Where DortDB becomes distinctive is not only support for multiple languages, but embedding one language inside another. A query can switch frontends with a `LANG` block and still reuse values from the surrounding scope.

Examples:

- SQL outer query with a Cypher subquery over graph data
- Cypher outer query with an XQuery `EXISTS` test over XML invoices
- SQL query that unwraps a list, delegates a subproblem to XQuery, and comes back with scalar results

See [Cross-language Queries](./cross-language-queries.md) for the syntax and patterns.

## Scope and Current Status

DortDB currently focuses on query processing over already-loaded data, not full database storage responsibilities. It does not aim to be a persistent DBMS replacement. The SQL, XQuery, and Cypher implementations intentionally prioritize practical querying and integration over full specification coverage.

For benchmark context and implementation details, see the thesis-backed pages in this docs section and the generated API reference.

## Next Steps

1. Read [Design Goals](./design-goals.md) for the architectural intent and tradeoffs.
2. Read [Core Overview](./core/overview.md) to understand the pipeline and extension boundaries.
3. Pick a language package: [SQL](./lang-sql/overview.md), [XQuery](./lang-xquery/overview.md), or [Cypher](./lang-cypher/overview.md).
4. Open the generated `API` section when you need exact signatures and exported types.
