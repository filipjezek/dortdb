---
sidebar_position: 1
title: XQuery Overview
description: Query XML, DOM trees, and similar structures with DortDB's XQuery frontend.
---

# `@dortdb/lang-xquery`

`@dortdb/lang-xquery` adds an XQuery frontend to DortDB.

In DortDB's multimodel architecture, XQuery is the language specialized for tree-shaped and XML-like structures, while still interoperating with SQL and Cypher through shared execution planning.

Its default adapter, `DomDataAdapter`, targets DOM and XML-like trees and allows controlled access to JavaScript object attributes through the attribute axis.

## Why XQuery In DortDB

XQuery is included to make hierarchical data first-class in the same runtime where you query rows and graphs.

Use it for:

- path navigation and structural filtering over trees
- FLWOR-style transformations
- XML-oriented construction and existence checks
- embedded document constraints inside larger SQL or Cypher workflows

## Typical Use Cases

Use the XQuery package when:

- your source data is XML or DOM-based
- you want path expressions, FLWOR expressions, or XML construction
- you need to embed document-oriented checks inside SQL or Cypher queries

## Where It Fits In Multimodel Queries

XQuery often appears as a focused subquery language:

- SQL can use XQuery to test XML payload conditions per row
- Cypher can use XQuery to validate or transform tree-like node payloads

This follows the DortDB goal of choosing the best language per subproblem instead of forcing one universal syntax.

## Configuration Surface

The main exported entry point is `XQuery(config?)`. The generated API also documents:

- `XQueryConfig`
- `XQueryLanguage`
- `XQueryDataAdapter`
- `DomDataAdapter`
- `XQueryFn`, `XQueryOp`, `XQueryAggregate`, and `XQueryCastable`

## Adapter Note

The default `DomDataAdapter` expects DOM globals. In browser runtimes that usually works directly. In non-browser runtimes you should provide a compatible adapter if `document` and related node types are not available.

## Scope Notes

The frontend focuses on practical query features needed for application integration. For concrete behavior differences and unsupported features, see [XQuery Dialect Notes](./dialect.md).

## Related Pages

- [XQuery Dialect Notes](./dialect.md)
- [Cross-language Queries](../cross-language-queries.md)
