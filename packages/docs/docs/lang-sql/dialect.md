---
sidebar_position: 2
title: SQL Dialect Notes
description: What the DortDB SQL frontend supports, and where it intentionally differs from a full database engine.
---

# SQL Dialect Notes

The SQL package is based on PostgreSQL-style `SELECT` syntax, but it is not trying to be a full relational database server.

## Notable Features

The package explicitly supports a few PostgreSQL-style constructs that are useful in embedded query workloads:

- `LATERAL` joins for correlated subqueries
- `DISTINCT ON`
- aggregate modifiers such as `DISTINCT`, `FILTER`, and `ORDER BY` inside aggregate calls
- object and collection helpers such as `ROW(...)`, `ARRAY(...)`, and JSON-like access operators

## Built-in SQL-specific Surface

The SQL frontend adds operators such as:

- `in`
- `not in`
- `between`
- `||`
- `like`
- `ilike`
- `->`
- `@>`

It also adds the `coalesce()` function.

See the generated API for adapter types and exported SQL AST and visitor contracts.

## Limitations

Important current limitations include:

- no window function execution support
- no common table expressions (`WITH` / CTEs) at runtime
- no schema-driven features that require static table metadata

The last point is a direct consequence of DortDB being source-oriented and schema-light. Queries that depend on inferred or declared schema in the database sense may need to be written more explicitly.

## Practical Advice

Prefer SQL as the outer language when your final result is row-shaped. Delegate only the graph- or document-specific parts to the other frontends.
