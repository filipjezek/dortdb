---
sidebar_position: 2
title: XQuery Dialect Notes
description: What the DortDB XQuery package supports and what it intentionally leaves out.
---

# XQuery Dialect Notes

The XQuery package is designed for practical querying over XML and tree-shaped data, not for full standards coverage.

## Supported Strengths

The package is strongest around:

- path expressions
- FLWOR expressions
- XML constructors
- sequence operations
- embedding inside other DortDB languages

It also contributes XQuery-specific plan operators that extend the shared logical algebra:

- `projectionSize`
- `treeJoin`

## Intentional Omissions

The current implementation does not aim to support the full XQuery type system. Notably absent:

- `typeswitch`
- `treat as`
- `instance of`
- `castable`
- validation features
- function references with explicit arity syntax

Other features may be added later, but are not currently implemented, such as:

- `try/catch`
- pragma expressions
- window FLWOR clauses
- inline functions
- module-system features beyond namespace definitions

## Built-ins

The package exports logical, context, and utility functions such as:

- `fn:not`
- `fn:true`
- `fn:false`
- `fn:exists`
- `fn:empty`
- `fn:data`
- `fn:position`
- `fn:last`

It also extends relational behavior with XQuery-specific comparison and sequence operators.
