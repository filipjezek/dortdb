---
sidebar_position: 1
title: Architecture
description:
  The DortDB query pipeline and how the core and language packages fit together.
---

# Architecture

[`@dortdb/core`](../api/@dortdb/core/index.md) is a small, **language-neutral**
engine. It owns the query lifecycle — registration, planning, optimization, and
execution — but ships no query language itself. Languages, functions, indices,
and optimizer rules are all plug-ins that attach to the core.

## The query pipeline

Every query follows the same path:

1. **Register.** In-memory data is registered as a source (an $O(1)$ operation).
   Optionally, it is indexed.
2. **Parse.** The selected language plug-in parses the query text into an
   abstract syntax tree (AST).
3. **Build a plan.** The AST is lowered into a **logical plan** of
   [unified-algebra](../formalism/algebra.md) operators. Because every language
   targets the same algebra, a query that mixes languages still becomes one
   plan.
4. **Optimize.** The
   [rule-based optimizer](../guides/indexing-and-performance.md) rewrites the
   plan (pushing down selections, using indices, and so on).
5. **Execute.** The executor evaluates the plan lazily over the registered
   sources.
6. **Serialize.** The executor works with an internal representation, so a
   language serializer converts results back into ordinary JavaScript values
   before they are returned.

The [`DortDB`](../api/@dortdb/core/default-export/classes/DortDB.md) methods map
onto these stages:
[`parse`](../api/@dortdb/core/default-export/classes/DortDB.md#parse),
[`buildPlan`](../api/@dortdb/core/default-export/classes/DortDB.md#buildplan),
[`executePlan`](../api/@dortdb/core/default-export/classes/DortDB.md#executeplan),
and the all-in-one
[`query`](../api/@dortdb/core/default-export/classes/DortDB.md#query). See
[Running Queries](../getting-started/running-queries.md).

## Packages

DortDB is a set of small packages so that a deployment bundles only what it
uses:

- **[`@dortdb/core`](../api/@dortdb/core/index.md)** — the engine, optimizer,
  index abstractions, and every extension point.
- **[`@dortdb/lang-sql`](../api/@dortdb/lang-sql/index.md)**,
  **[`@dortdb/lang-cypher`](../api/@dortdb/lang-cypher/index.md)**,
  **[`@dortdb/lang-xquery`](../api/@dortdb/lang-xquery/index.md)** — the
  provided language plug-ins, one per data model.
- **[`@dortdb/datetime`](../api/@dortdb/datetime/index.md)** — an example
  extension bundling date/time functions.

Each language declares the core as a peer dependency, so one core instance backs
all loaded languages.

## Extending the algebra: the visitor pattern

The core processes plans with an **extended visitor pattern**. A plan operator's
[accept()](../api/@dortdb/core/default-export/interfaces/PlanOperator.md#accept)
method receives a _dictionary of visitors keyed by language_, and dispatch keys
on both the operator's type and the language that **instantiated** it: a core
operator built by SQL is handled by SQL's visitor, the same operator type built
by Cypher by Cypher's. A language implements the full visitor interface —
usually by subclassing the core visitor and overriding only the methods for the
operators it adds — which is what lets it grow the algebra without changing the
core. For instance, XQuery adds a
[`TreeJoin`](../formalism/operators.md#treejoin) operator for path navigation.
See [Plan Visitors](./plan-visitors.md) for the individual passes.

This is the seam that [Extending DortDB](../guides/extending/overview.md) builds
on. The formal side — what the operators mean — is covered in the
[Formalism](../formalism/overview.md) section.

## Execution model

Execution is **lazy, synchronous, and single-threaded**: iterating a result
pulls rows through the operator tree on the calling thread, so functions and
aggregates must be synchronous. The engine is schema-free — sources are plain
in-memory values read through
[data adapters](../guides/data-sources-and-adapters.md) — which is what keeps
registration free and languages decoupled from data shape. See
[Limitations](./limitations.md) for the consequences of these choices.
