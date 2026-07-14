# @dortdb/core

The language-neutral engine at the heart of
[DortDB](https://github.com/filipjezek/dortdb), a modular framework for querying
JavaScript data that already lives in your application's memory.

`@dortdb/core` owns the whole query lifecycle (source registration, planning,
optimization, and execution) together with every extension point, but it ships
no query language of its own. You pair it with one or more language packages:

- [`@dortdb/lang-sql`](https://www.npmjs.com/package/@dortdb/lang-sql): SQL over arrays of objects
- [`@dortdb/lang-cypher`](https://www.npmjs.com/package/@dortdb/lang-cypher): Cypher-based queries over property graphs
- [`@dortdb/lang-xquery`](https://www.npmjs.com/package/@dortdb/lang-xquery): XQuery over XML, DOM, and tree-shaped data

## Installation

```sh
npm install @dortdb/core @dortdb/lang-sql
```

Each language declares `@dortdb/core` as a peer dependency, so a single core
instance is shared across all of them.

## Usage

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
});

const users = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 },
];

// registering a source just pairs data with a name: no copying, no import
db.registerSource(['users'], users);

const result = db.query(`
  SELECT name, age
  FROM users
  WHERE age > 30
`);
// result.schema -> ['name', 'age']
// result.data   -> [{ name: 'Charlie', age: 35 }]
```

## What's in the box

- The [`DortDB`](https://filipjezek.github.io/dortdb/docs/getting-started/first-query) engine class, plus `parse` / `buildPlan` / `executePlan` for step-by-step control.
- A rule-based optimizer and the pre-ordered [`defaultRules`](https://filipjezek.github.io/dortdb/docs/formalism/optimization) set.
- Index abstractions (`MapIndex`, hash joins) for [faster lookups and joins](https://filipjezek.github.io/dortdb/docs/guides/indexing-and-performance).
- Extension points for languages, functions, aggregates, operators, castables, data adapters, index types, and optimizer rules.

Because the core and each language are separate packages, a browser bundle
includes only the languages and extensions you actually import.

## Documentation

Full documentation lives at
**[filipjezek.github.io/dortdb](https://filipjezek.github.io/dortdb)**, including
the [architecture](https://filipjezek.github.io/dortdb/docs/core/architecture),
the [unified algebra](https://filipjezek.github.io/dortdb/docs/formalism/overview)
every language compiles to, and the
[extension model](https://filipjezek.github.io/dortdb/docs/guides/extending/overview).
A generated [API reference](https://filipjezek.github.io/dortdb/docs/api) covers
the exact type signatures.

Try the [live demo](https://filipjezek.github.io/dortdb/showcase/) to build queries and
watch their plans.
