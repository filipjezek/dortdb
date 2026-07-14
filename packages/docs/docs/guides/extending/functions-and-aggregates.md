---
sidebar_position: 2
title: Functions & Aggregates
description: Add functions, operators, aggregates, and casts as extensions.
---

# Functions & Aggregates

The most common way to extend DortDB is to add **functions**, **operators**,
**aggregates**, and **castables**, grouped into an [extension](./overview.md) that
you register on the engine.

## Functions

A function has a unique name and an implementation. Mark it `pure` when it has no
side effects and returns the same output for the same input (which lets the
optimizer reason about it):

```ts
const myExtension = {
  functions: [{ name: 'double', impl: (v: number) => v * 2, pure: true }],
};

const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
  extensions: [myExtension],
});

db.query('SELECT double(x) AS d FROM t');
// with t = [{ x: 5 }, { x: 7 }] → [{ d: 10 }, { d: 14 }]
```

## Aggregates

An aggregate is expressed as three parts: `init` to create the starting state,
`step` to fold in each value, and `result` to extract the final value:

```ts
const myExtension = {
  aggregates: [
    {
      name: 'product',
      init: () => 1,
      step: (state: number, v: number) => state * v,
      result: (state: number) => state,
    },
  ],
};

db.query('SELECT product(x) AS p FROM t');
// with t = [{ x: 5 }, { x: 7 }] → [{ p: 35 }]
```

By default aggregates ignore nulls; set `includeNulls: true` to fold them in. An
optional `stepInverse` can speed up window-style use.

## Operators and castables

- **Operators** (`{ name, impl }`) back query operators such as `+` or `like`.
  Only languages that support user-defined operators (e.g. SQL) will pick them up.
- **Castables** (`{ name, convert }`) back cast keywords, as in SQL's
  `CAST(val AS mytype)`.

## Scoping and namespacing

Set `scope` to restrict an extension to specific languages, and `schema` to
namespace all of its members under a prefix:

```ts
const xqueryOnly = {
  scope: ['xquery'],
  aggregates: [
    /* ... only visible to XQuery ... */
  ],
};
```

## Worked example: the `datetime` extension

The provided [`@dortdb/datetime`](../../api/@dortdb/datetime/index.md) extension bundles date/time helpers and is a good
reference for how an extension is packaged:

```ts
import { datetime } from '@dortdb/datetime';

const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
  extensions: [datetime],
});

db.query(
  "SELECT date.extract(date.sub(now(), interval('3 years')), 'year') AS y FROM t",
);
```
