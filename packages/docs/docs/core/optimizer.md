---
sidebar_position: 4
title: Optimizer
description: The unified plan model in DortDB and where optimizer rules fit.
---

# Optimizer

Every language frontend lowers into the same logical execution model. That is why DortDB can apply shared optimizer rules even when a query contains nested `LANG` blocks.

## Unified Algebra

The logical plan algebra is described in the repository-level `algebra.md` file. At a high level it covers:

- tuple operators such as selection, projection, joins, grouping, ordering, recursion, and tuple sources
- item operators such as calculations, literals, function calls, quantifiers, and item sources
- shared operators such as union, intersection, difference, and limit

XQuery adds a few custom operators on top of the shared core, notably `projectionSize` and `treeJoin`.

## Configuration

The `DortDBConfig` object accepts optimizer configuration and constructs an `Optimizer` instance behind the scenes. Most applications only need to choose which rules are enabled.

## Rule Shape

Optimizer rules work on the shared plan tree, not on source text. That makes them reusable across language frontends as long as the rewritten plan semantics still hold.

The showcase app demonstrates rules such as:

- `IndexScans`
- `JoinIndices`
- `MergeProjections`
- `PushdownSelections`
- `UnnestSubqueries`
- `ProjConcatToJoin`
- `productsToJoins`
- `mergeFromToItems`
- `mergeToFromItems`

## When To Inspect Plans

Inspect plans when:

- you are debugging a language integration
- you are writing a custom optimizer rule
- you want to confirm that indices are actually being used
- you are validating cross-language execution behavior

The core package exports plan visitor interfaces for that purpose, and the showcase visualizer is a good reference for tooling around plans.
