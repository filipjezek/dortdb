# DortDB - XQuery

This package is a language plugin for [DortDB](https://github.com/filipjezek/dortdb). It adds support for XQuery queries.

## Data adapter

The default data adapter implementation allows queries against DOM and XML data structures. It also allows accessing JS object properties with the attribute axis (`obj/@prop`).

## Differences between DortDB and XQuery

The DortDB XQuery implementation does not include any typing except cast expressions. This means that the following is not (and is not ever planned to be)
available:

- `as` keyword
- `typeswitch` expressions
- `treat` expressions
- `instance of` expressions
- `castable` expressions
- `validate` expressions
- any function types except `function(*)`
- function references containing arity information (`fnname#arity`)

The following is also not implemented, but may be added in the future:

- `try catch` expressions
- `pragma` expressions
- `window` FLWOR clause
- inline functions
- `%private` and `%public` modifiers
- any module prolog except namespace definition
