---
sidebar_position: 3
title: Design Principles
description: The principles that shape DortDB's architecture.
---

# Design Principles

DortDB is a TypeScript framework for querying **existing in-memory data**, built
to be as configurable and modular as possible. A handful of principles explain
most of its design decisions.

## Language neutrality

Different query languages have different strengths, but the operations they
express are ultimately similar: graph pattern matching, for instance, can be
understood as a sequence of selections and joins. DortDB separates _languages_
from _planning and execution_, and lets you choose which languages to load as
plug-ins. No language is privileged: any loaded language can be the outer
language, and any can be nested inside another.

## Schema agnosticism

DortDB targets the browser and the querying of ordinary JavaScript values, which
are dynamically typed and permissive. It therefore takes a **schema-free**
approach: there is no schema to declare and no import step. This keeps
registration a constant-time operation and keeps languages decoupled from the
concrete shape of the data (that shape is handled by
[data adapters](../guides/data-sources-and-adapters.md)). The trade-off is that a
few schema-dependent language features are restricted; see
[Limitations](./limitations.md).

## An algebra as the compilation target

To decouple languages from the rest of the framework, each language parses its
queries into one **unified algebra**. The engine then reasons about algebraic
operators rather than language-specific constructs, which is what makes the
optimizer and executor language-agnostic. The algebra is described in the
[Formalism](../formalism/overview.md) section.

## Multi-language queries

Because every language compiles to the same representation, a single query can
**mix languages** through nested language subqueries, and the whole thing is
optimized and executed as one plan. See
[Cross-language Queries](../guides/cross-language-queries.md).

## Extensibility and modularity

Extensibility is a fundamental goal. A new language can lean on the framework for
most of the work, but every stage can be customized: you can add **new algebra
operators** for new concepts or data models (XQuery's [`TreeJoin`](../formalism/operators.md#treejoin)
and [`ProjectionSize`](../formalism/operators.md#projectionsize) operators are examples), add **optimizer rules**, or add **functions,
aggregates, and index types**. Modularity serves the same goal from the packaging
side: small, separate packages keep web bundles small. See
[Extending DortDB](../guides/extending/overview.md).
