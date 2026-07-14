---
sidebar_position: 1
title: XQuery Overview
description: Query XML, DOM, and tree-shaped data with the DortDB XQuery language.
---

# XQuery

[`@dortdb/lang-xquery`](../api/@dortdb/lang-xquery/default-export/functions/XQuery.md) adds XQuery to DortDB. It is the language for **tree-shaped
and XML-like data**, such as DOM documents, parsed XML, and similar hierarchical
structures, and it brings XPath path navigation together with FLWOR
transformations.

XQuery works on **sequences** of values. Sequences never nest (a sequence of
sequences is flattened), a single value is a sequence of length one, and an empty
sequence stands in for "no value".

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

db.query('for $p in $people/people/person return string($p/@age)');
// data: ['30', '20']

db.query('for $p in $people/people/person[@age > 25] return string($p)');
// data: ['Alice']
```

## FLWOR and sequences

FLWOR expressions (**F**or, **L**et, **W**here, **O**rder by, **R**eturn) stream
data as named tuples between clauses, but a FLWOR expression as a whole produces
a flattened sequence of items:

```ts
db.query('for $x in (1 to 3) let $y := $x * 10 return $y');
// data: [10, 20, 30]
```

Aggregation is done by passing a sequence to a function:

```ts
db.query('sum(1 to 10)'); // data: [55]
```

Path predicates can read the current context item (`.`), position
(`fn:position()`), and size (`fn:last()`):

```ts
db.query('(5 to 10)[. mod 2 eq 1]'); // data: [5, 7, 9]
```

## The DOM adapter

By default XQuery reads data through [`DomDataAdapter`](../api/@dortdb/lang-xquery/default-export/classes/DomDataAdapter.md),
which expects DOM globals (`document`, `Node`, and friends).

- **In the browser** these are available, so [`XQuery()`](../api/@dortdb/lang-xquery/default-export/functions/XQuery.md) works directly.
- **In Node.js** there is no DOM by default. Supply a document from a DOM
  implementation (e.g. [`jsdom`](https://github.com/jsdom/jsdom)), as in `XQuery({ adapter: new DomDataAdapter(doc) })`,
  and make the DOM globals available, or provide a custom adapter that targets
  your own data shape. See
  [Data Sources & Adapters](../guides/data-sources-and-adapters.md).

## Learn more

- [XQuery Dialect & Restrictions](./dialect.md): the supported subset and what
  is intentionally left out.
- The API reference for [`XQuery`](../api/@dortdb/lang-xquery/default-export/functions/XQuery.md),
  [`XQueryConfig`](../api/@dortdb/lang-xquery/default-export/interfaces/XQueryConfig.md),
  [`XQueryDataAdapter`](../api/@dortdb/lang-xquery/default-export/interfaces/XQueryDataAdapter.md), and
  [`DomDataAdapter`](../api/@dortdb/lang-xquery/default-export/classes/DomDataAdapter.md).
