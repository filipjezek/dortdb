---
sidebar_position: 2
title: XQuery Dialect & Restrictions
description: The supported XQuery 3.0 subset and the features DortDB leaves out.
---

# XQuery Dialect & Restrictions

DortDB's XQuery is a **subset of XQuery 3.0** (which itself is a superset of
XPath). It focuses on the data-selection and transformation core: path
expressions, FLWOR, and sequence operations.

## Supported

- **XPath** path expressions and predicates over DOM/XML trees.
- **FLWOR** expressions (`for` / `let` / `where` / `order by` / `return`).
- **Sequences** and sequence-valued functions (aggregation via `sum`, etc.).
- The static/dynamic context: current item (`.` or `$fs:dot`), position
  (`fn:position()` / `$fs:position`), and size (`fn:last()` / `$fs:last`).
- Namespace declarations, e.g. `declare namespace foo = "http://example.org";`.
- `cast` expressions (the only typing construct that is supported).

XQuery contributes its own plan operators (such as tree navigation) that extend
the shared algebra — see the [language mapping](../formalism/language-mapping.md).

## Not implemented — and not planned

DortDB's XQuery deliberately omits the type system. The following are **not**
available and are not planned:

- the `as` keyword (type declarations)
- `typeswitch` expressions
- `instance of` expressions
- `treat` expressions
- `castable` expressions
- `validate` expressions
- function types other than `function(*)`
- named function references with arity (`fnname#arity`)

## Not implemented — possibly later

These may be added in the future but are not available today:

- `try` / `catch` expressions
- pragma expressions
- the `window` FLWOR clause
- inline functions
- `%private` / `%public` annotations
- module prolog features beyond namespace definitions

## Standard library

Only a subset of the XQuery/XPath standard-library functions is implemented, so
some functions you know from full XQuery engines may be missing. Missing
functions can be supplied as [extensions](../guides/extending/functions-and-aggregates.md).

XQuery functions automatically receive the [current dynamic context](../api/@dortdb/lang-xquery/default-export/interfaces/FnContext.md) as their last argument,
so they can access the current item, position, and size. Additionally, arguments of
aggregates, functions and castables are by default [atomized](https://www.w3.org/TR/xquery-30/#id-atomization),
but it is possible to opt out of that behavior:

```ts
/** XQuery-specific extension of {@link Fn} that can suppress automatic argument atomization. */
export interface XQueryFn extends Fn {
  /** When `true`, arguments are passed as-is, bypassing XQuery atomization. */
  skipAtomization?: boolean;
}
```

## XQuery and tuples

XQuery streams named tuples _within_ a FLWOR expression, but it cannot accept or
produce tuples at its boundaries — a FLWOR expression returns a flattened
sequence of opaque items. This matters when embedding XQuery in another language:
an XQuery block yields item(s), not rows. See
[Cross-language Queries](../guides/cross-language-queries.md).
