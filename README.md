<!-- prettier-ignore-start -->

<p align="center">
  <img src="packages/docs/static/img/logo.png" alt="DortDB logo" width="120" height="120" />
</p>

<h1 align="center">DortDB</h1>

<p align="center">
  <strong>A modular, multi-language query engine for the JavaScript data already in your app's memory.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dortdb/core"><img src="https://img.shields.io/npm/v/@dortdb/core.svg" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@dortdb/core.svg" alt="license" /></a>
</p>

<p align="center">
  📖 <a href="https://filipjezek.github.io/dortdb"><strong>Documentation</strong></a> &nbsp;·&nbsp;
  🕹️ <a href="https://filipjezek.github.io/dortdb/showcase/"><strong>Live demo</strong></a> &nbsp;·&nbsp;
  🎓 <a href="http://hdl.handle.net/20.500.11956/209701"><strong>Thesis</strong></a>
</p>

DortDB queries arrays, DOM trees, and graphs **in place**, without moving them
into a separate database process. It is not tied to one query language: SQL,
Cypher, and XQuery ship in the box, they can be **mixed in a single query**, and
you can add your own. Every language compiles to one shared algebra, so a
cross-model query is optimized and executed as a single plan.

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

const db = new DortDB({ mainLang: SQL(), optimizer: { rules: defaultRules } });

db.registerSource(['users'], [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
]);

db.query('SELECT name FROM users WHERE age > 27');
// { schema: ['name'], data: [{ name: 'Alice' }] }
```

## Contents

- [Is DortDB for you?](#is-dortdb-for-you)
- [Installation](#installation)
- [Multiple languages in one query](#multiple-languages-in-one-query)
- [Data adapters](#data-adapters)
- [Secondary indices](#secondary-indices)
- [Extensions](#extensions)
- [Packages](#packages)
- [Documentation](#documentation)
- [Alternatives](#alternatives)

## Is DortDB for you?

**DortDB lets you:**

- Query data that is already in memory (arrays, DOM/XML, graphs) with no import or copy step.
- Mix relational, document, and graph queries in one query, each part in the language that fits it best.
- Ship a small, tree-shakeable engine to the browser or Node, bundling only the languages you use.
- Extend the engine with your own languages, functions, indices, or optimizer rules.

**DortDB does not:**

- Provide persistence, transactions, or data modification. DortDB is read-only and in-memory only.
- Have cost-based optimization or multi-threaded execution over very large datasets. The optimizer is rule-based and execution is single-threaded.
- Ship extensive built-in libraries for each language (yet) (you can add your own).

See [Alternatives](#alternatives) for libraries that may be a better fit for your use case.

## Installation

Install the core plus whichever language packages you need:

```sh
npm i @dortdb/core @dortdb/lang-sql
# add more languages when you need them
npm i @dortdb/lang-cypher graphology @dortdb/lang-xquery
```

`graphology` is a peer dependency of the Cypher
package only.

## Multiple languages in one query

The distinctive feature of DortDB is **embedding one language inside another**. A
`LANG` block switches languages, and the inner query can reference values from
the surrounding scope. Because everything lowers to the same algebra, the whole
query is optimized and executed as one plan rather than as opaque nested calls.

```ts
const db = new DortDB({
  mainLang: SQL(),
  additionalLangs: [XQuery()],
  optimizer: { rules: defaultRules },
});

db.registerSource(['users'], [/* ... */]);
db.registerSource(['invoices'], new DOMParser().parseFromString('...', 'text/xml'));

// SQL filters users by a count computed with XQuery over an XML document
db.query(`
  SELECT name, age
  FROM users
  WHERE age > 30 AND (
    LANG xquery
    fn:count($invoices/customer[. = $users:name])
  ) > 5
`);
```

- A block starts with `LANG <name>` and ends at its enclosing scope (such as a closing parenthesis) or an explicit `LANG EXIT`.
- Blocks can nest to any depth, and inner queries can read values from any outer scope.

See [Cross-language Queries](https://filipjezek.github.io/dortdb/docs/guides/cross-language-queries)
for the full syntax and scope rules.

## Data adapters

DortDB decouples each language from the concrete shape of your data through
**data adapters**, so you can point a language at differently-shaped sources. For
example, teaching SQL to read `Map`-backed rows instead of plain objects:

```ts
const db = new DortDB({
  mainLang: SQL({
    adapter: {
      createColumnAccessor: (prop) => (row: Map<string, unknown>) => row.get(prop),
    },
  }),
  optimizer: { rules: defaultRules },
});

db.registerSource(['users'], [
  new Map([['name', 'Alice'], ['age', 30]]),
  new Map([['name', 'Bob'], ['age', 25]]),
]);

db.query('SELECT name, age FROM users WHERE age > 27');
```

## Secondary indices

Register secondary indices for faster lookups and joins. The optimizer uses a
matching index automatically.

```ts
import { DortDB, MapIndex } from '@dortdb/core';

db.registerSource(['users'], [/* ... */]);

// index a column, or any subquery-free expression
db.createIndex(['users'], ['age'], MapIndex);
db.createIndex(['users'], ['name[0] + age'], MapIndex);
```

Index classes can also accelerate joins over non-indexed streams. Make them
available to the executor with `hashJoinIndices`:

```ts
new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
  executor: { hashJoinIndices: [MapIndex] },
});
```

See [Indexing & Performance](https://filipjezek.github.io/dortdb/docs/guides/indexing-and-performance).

## Extensions

Bundle custom functions, operators, aggregates, and casts as an extension. The
provided [`@dortdb/datetime`](./packages/extensions/datetime) extension adds
date/time helpers:

```ts
import { datetime } from '@dortdb/datetime';

const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
  extensions: [datetime],
});

db.query(`SELECT date.sub(now(), interval('3 years'))`);
```

See [Extending DortDB](https://filipjezek.github.io/dortdb/docs/guides/extending/overview).

## Packages

| Package | Description |
| ------- | ----------- |
| [`@dortdb/core`](./packages/core) | The language-neutral engine, optimizer, index abstractions, and extension points. |
| [`@dortdb/lang-sql`](./packages/lang-sql) | SQL over arrays of objects. |
| [`@dortdb/lang-cypher`](./packages/lang-cypher) | Cypher-based queries over property graphs. |
| [`@dortdb/lang-xquery`](./packages/lang-xquery) | XQuery over XML, DOM, and tree-shaped data. |
| [`@dortdb/datetime`](./packages/extensions/datetime) | Example extension bundling date/time functions. |

The `@dortdb/lang-cypher` package is a set of implementation extensions to
Cypher, based on the [openCypher](https://opencypher.org/) grammar (Apache
License 2.0). It is not approved by the openCypher Implementers Group. Cypher® is
a registered trademark of Neo4j, Inc.

## Documentation

Full documentation, guides, and a generated API reference live at
**[filipjezek.github.io/dortdb](https://filipjezek.github.io/dortdb)**:

- [Getting Started](https://filipjezek.github.io/dortdb/docs/intro)
- [Cross-language Queries](https://filipjezek.github.io/dortdb/docs/guides/cross-language-queries)
- [Core Concepts](https://filipjezek.github.io/dortdb/docs/core/architecture) and the [Formalism](https://filipjezek.github.io/dortdb/docs/formalism/overview)
- [Extending DortDB](https://filipjezek.github.io/dortdb/docs/guides/extending/overview)

The design and formal background are described in depth in the
[thesis](http://hdl.handle.net/20.500.11956/209701).

## Alternatives

Is DortDB not the right tool for your use case? Here are some other libraries:

**SQL:**

- [AlaSQL](https://github.com/AlaSQL/alasql): A full SQL engine for Node and the browser, with persistence and data modification. It is larger and mostly slower than DortDB, but has more features and built-in functions. Can work on existing arrays etc.
- [sql.js](https://github.com/sql-js/sql.js): SQLite compiled to WebAssembly. It is a full, very fast SQL engine with persistence and data modification, but it requires copying data into its own database format.
- [PGlite](https://github.com/electric-sql/pglite): PostgreSQL compiled to WebAssembly. Similar as above.
- [DuckDB-WASM](https://github.com/duckdb/duckdb-wasm): High-performance analytical SQL engine compiled to WebAssembly. Provides many extensions and features, requires copying data into its own database format.

**XQuery:**

- [fontoxpath](https://github.com/FontoXML/fontoxpath): An XQuery 3.1 engine for Node and the browser. Can modify data. Likely faster than DortDB, but have not compared yet.
- [`document.evaluate`](https://developer.mozilla.org/en-US/docs/Web/API/Document/evaluate): The built-in XPath engine in browsers. Can only evaluate XPath, not full XQuery.

**No query language:**

- [PouchDB](https://github.com/apache/pouchdb): Inspired by Apache CouchDB, can store data in IndexedDB or WebSQL in the browser, and sync with a CouchDB server. Lightweight.
- [RxDB](https://github.com/pubkey/rxdb): A reactive database with offline-first support. Can sync with a server. More features than PouchDB, but also larger and more complex.

## License

Released under the [ISC License](./LICENSE), except for the openCypher-derived
grammar in `@dortdb/lang-cypher`, which is under the Apache License 2.0 (see that
package's [`NOTICE`](./packages/lang-cypher/NOTICE)).

<!-- prettier-ignore-end -->
