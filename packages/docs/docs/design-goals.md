---
sidebar_position: 2
title: Design Goals
description: The core motivations and constraints that shape DortDB.
---

# Design Goals

This page summarizes the high-level goals behind DortDB as described in the thesis, and explains how they map to the current architecture.

## 1. Browser-First Execution

DortDB targets web and JavaScript runtime environments where data is already in memory.

Implications:

- low friction integration with existing JS/TS application objects
- no requirement to run a separate database process
- practical support for interactive filtering, projection, grouping, and analysis in client-facing apps

## 2. Modularity and Bundle Awareness

DortDB is split into a core package and language packages.

Implications:

- applications can import only what they need
- dead code elimination and tree shaking can reduce shipped bytes
- language frontends and optional features remain decoupled

## 3. Multilanguage Over Universal-Language Design

Instead of inventing a new query language, DortDB allows language switching with `LANG` blocks.

Implications:

- SQL remains natural for tabular tasks
- XQuery remains natural for XML/tree tasks
- Cypher remains natural for graph pattern tasks
- multimodel queries can combine these strengths in one logical plan

## 4. Unified Algebra and Cross-Language Planning

Language-specific parsing eventually maps into a shared logical representation.

Implications:

- one optimizer pipeline can reason across language boundaries
- nested language blocks can still participate in rule-based rewrites
- execution is orchestrated by one engine rather than isolated sub-engines

## 5. Extensibility as a First-Class Requirement

DortDB is designed to be extended, not only configured.

Extension points include:

- language integrations
- custom functions and aggregates
- custom operators and castables
- secondary index implementations

## 6. Performance by Planning and Indexing

DortDB improves performance through logical-plan optimization and optional secondary indices.

Implications:

- better performance on complex queries than naive imperative code in many scenarios
- reusable optimization rules for all supported languages
- explicit index abstractions that can be attached to relevant sources

## 7. Practical Scope

DortDB is a query engine for in-memory application data. It is not trying to be a complete persistent DBMS.

Current language implementations prioritize practical usefulness and interoperability. Some language-specification features are intentionally out of scope or not yet implemented.

## 8. Validation Strategy

The thesis evaluates DortDB against:

- multimodel systems on UniBench
- JavaScript in-memory SQL systems on TPC-H style queries

This informs where DortDB performs well today and where future optimization work is most valuable.
