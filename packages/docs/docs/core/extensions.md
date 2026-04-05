---
sidebar_position: 2
title: Extensions
description: Add operators, functions, aggregates, and castables to DortDB.
---

# Extensions

DortDB extensions are how you add reusable query functionality without forking a language package. An extension can contribute:

- operators
- scalar functions
- aggregate functions
- castables

The contract lives in `@dortdb/core` and is shared across languages.

## Extension Shape

An `Extension` can include:

- `schema`: a namespace prefix applied to its members
- `operators`
- `functions`
- `aggregates`
- `castables`
- `scope`: optional language restriction

That last field matters when a function only makes sense for one frontend.

## Registering Extensions

Register extensions through the `DortDB` constructor.

```ts
import { DortDB, type Extension } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';

const analytics: Extension<'sql'> = {
  schema: 'analytics',
  scope: ['sql'],
  functions: [
    {
      name: 'slug',
      pure: true,
      impl: (value: string) => value.toLowerCase().replace(/\s+/g, '-'),
    },
  ],
};

const db = new DortDB({
  mainLang: SQL(),
  extensions: [analytics],
});
```

## Core Built-ins

The engine ships with a built-in `core` extension that registers the standard operators, functions, aggregates, and castables exposed by `@dortdb/core`. The `datetime` extension is also exported explicitly for convenience.

## Design Notes

Good extension functions are:

- deterministic when marked `pure`
- narrow in scope
- explicit about output shape if used as tuple sources

For exact field names and type signatures, use the generated API reference for `Extension`, `Fn`, `AggregateFn`, `Operator`, and `Castable`.
