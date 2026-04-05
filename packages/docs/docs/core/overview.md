---
sidebar_position: 1
title: Core Overview
description: Understand the DortDB core pipeline, optimizer, and extension boundaries.
---

# `@dortdb/core`

`@dortdb/core` is the execution engine behind every language package. It owns the `DortDB` runtime facade and orchestrates parsing handoff, logical plan construction, optimization, and execution.

Language packages parse and translate queries, but the core remains the control point for query lifecycle and cross-language behavior.

## What The Core Owns

At a high level, the core package owns:

- source registration and data access abstraction
- language registration and selection
- logical planning pipeline
- optimizer rule execution
- secondary index integration
- execution context and plan execution
- extension lifecycle and contracts

## Runtime Entry Points

The generated API section documents the exported signatures in detail. The most important concepts to know up front are:

- `DortDB`: the runtime facade used by application code
- `DortDBConfig`: selects the main language, additional languages, extensions, and optimizer configuration
- `QueryOptions`: per-query language selection and bound parameters
- `QueryResult`: materialized output from `query()`
- `Language` and `LanguageManager`: the abstraction layer used by language packages
- `Extension`, `Fn`, `AggregateFn`, `Operator`, and `Castable`: contracts for extending the engine
- `Index` and `MapIndex`: secondary index abstractions used by optimizer rules and adapters

## Query Pipeline

The usual processing path is:

1. Parse source query text with the selected language package.
2. Build a logical plan in the unified execution model.
3. Apply optimizer rules (including index-aware rewrites where possible).
4. Execute the optimized plan against registered sources.
5. Materialize output if needed.

This is the foundation that enables cross-language optimization instead of treating nested language blocks as opaque calls.

## Typical Application Flow

Most applications use the core package in this order:

1. Construct `DortDB` with a main language and optional additional languages.
2. Register application sources with `registerSource()`.
3. Optionally register extensions and create secondary indices.
4. Run `query()` for convenience, or use `parse()`, `buildPlan()`, and `executePlan()` when you need more control.

## Core Methods (Practical)

At a high level:

- `parse(query, options)` converts source text into AST nodes.
- `buildPlan(ast, options)` translates AST into a logical plan and runs optimizer rules.
- `executePlan(plan, boundParams)` executes a plan without forcing materialization.
- `query(query, options)` is the convenience wrapper that parses, plans, executes, and materializes.
- `registerSource(path, value)` exposes application data to queries.
- `createIndex(path, expressions, indexCls, options)` creates and fills secondary indices.

## Data Shape and Tradeoffs

The core engine is intentionally schema-light. That design keeps data adapters flexible, but it also means some language-specific features that rely on a static schema are limited or intentionally unsupported. SQL is the package where this tradeoff is most visible.

This tradeoff is deliberate for browser-centric multimodel workloads, where source data often originates in heterogeneous runtime objects rather than fixed relational catalogs.

## Extensibility Boundary

Core interfaces are designed so users can add behavior without forking the engine:

- language features via language packages
- domain functions and aggregates via extensions
- custom data operators and casts
- custom index structures for specialized access patterns

## Generated API

Use the `API` section in the navbar when you need exact details for:

- generic parameters on `DortDB`
- method signatures
- interface fields and visitor contracts
- exported AST, plan, and execution types

This guide section stays focused on architecture and usage patterns rather than duplicating signatures.
