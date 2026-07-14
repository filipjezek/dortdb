# @dortdb/lang-xquery

An XQuery language plug-in for [DortDB](https://github.com/filipjezek/dortdb). It
adds XQuery, the language for **tree-shaped and XML-like data**: DOM documents,
parsed XML, and similar hierarchical structures, with XPath path navigation and
FLWOR transformations.

## Installation

```sh
npm install @dortdb/core @dortdb/lang-xquery
```

`@dortdb/core` is a peer dependency.

## Usage

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { XQuery, DomDataAdapter } from '@dortdb/lang-xquery';

const db = new DortDB({
  // in a browser, XQuery() picks up the global document automatically
  mainLang: XQuery({ adapter: new DomDataAdapter(document) }),
  optimizer: { rules: defaultRules },
});

const people = new DOMParser().parseFromString(
  `<people>
     <person age="30">Alice</person>
     <person age="20">Bob</person>
   </people>`,
  'text/xml',
);
db.registerSource(['people'], people);

db.query('for $p in $people/people/person[@age > 25] return string($p)');
// ['Alice']
```

## Data adapter

The default adapter targets DOM and XML trees, and also reads JS object
properties through the attribute axis (`obj/@prop`). In the browser the global
`document` is used automatically; in Node.js supply a document from a DOM
implementation (such as [`jsdom`](https://github.com/jsdom/jsdom)) and make the
DOM globals available, or provide a custom adapter for your own tree shape.

## Dialect

This is a subset of **XQuery 3.0** focused on data selection: path expressions,
FLWOR, and sequence operations. It deliberately omits the type system, so the
following are **not** available and are not planned: the `as` keyword,
`typeswitch`, `instance of`, `treat`, `castable`, `validate`, function types
other than `function(*)`, and named function references with arity
(`fnname#arity`). Only `cast` expressions are supported.

Not implemented today, but possibly added later: `try` / `catch`, pragma
expressions, the `window` FLWOR clause, inline functions, `%private` / `%public`
annotations, and module prolog features beyond namespace definitions.

## Custom plan operators

XQuery extends the DortDB
[unified algebra](https://filipjezek.github.io/dortdb/docs/formalism/operators)
with two operators:

| Operator         | Description                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ProjectionSize` | Adds an attribute holding the total number of rows in the stream (exposes `$fs:last` during path navigation).                                     |
| `TreeJoin`       | Implements path steps like `a/b/c`. Like `ProjectionConcat`, but its expression yields items, and it also supplies the XQuery focus per step (`$fs:dot`, `$fs:position`, `$fs:last`). |

These demonstrate that the algebra is extensible; see
[Extending DortDB](https://filipjezek.github.io/dortdb/docs/guides/extending/overview).

## Documentation

See the [XQuery overview](https://filipjezek.github.io/dortdb/docs/lang-xquery/overview)
and [dialect reference](https://filipjezek.github.io/dortdb/docs/lang-xquery/dialect),
or the full docs at
[filipjezek.github.io/dortdb](https://filipjezek.github.io/dortdb).
