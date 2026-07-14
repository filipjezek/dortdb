---
sidebar_position: 1
title: Installation
description: Install the DortDB core and the language packages you need.
---

# Installation

DortDB is distributed as a set of npm packages. You always install the core, and
then add one or more language packages.

## Core

```bash npm2yarn
npm install @dortdb/core
```

[`@dortdb/core`](../api/@dortdb/core/index.md) contains the [`DortDB`](../api/@dortdb/core/default-export/classes/DortDB.md)
engine, the optimizer, the index abstractions, and all the extension points. It ships no query language on its
own — you add those separately.

## Language packages

Install whichever of the provided languages you want to use:

```bash npm2yarn
npm install @dortdb/lang-sql
npm install @dortdb/lang-cypher graphology
npm install @dortdb/lang-xquery
```

- **[`@dortdb/lang-sql`](../lang-sql/overview.md)** — SQL over object-shaped rows.
- **[`@dortdb/lang-cypher`](../lang-cypher/overview.md)** — Cypher over property graphs. Its default data
  adapter is backed by [Graphology](https://graphology.github.io/), so install
  `graphology` alongside it (it is a peer dependency).
- **[`@dortdb/lang-xquery`](../lang-xquery/overview.md)** — XQuery over XML / DOM / tree-shaped data.

Each language package declares [`@dortdb/core`](../api/@dortdb/core/index.md) as a peer dependency, so a single
core instance is shared across all of them.

:::tip[Bundle size]
Because the core and each language are separate packages, a browser bundle only
includes the languages and extensions you actually import. Loading SQL does not
pull in the Cypher or XQuery parsers.
:::

## Optional extensions

Extensions bundle extra functions, operators, or aggregates. The provided
[`datetime`](../api/@dortdb/datetime/index.md) extension adds date/time helpers:

```bash npm2yarn
npm install @dortdb/datetime
```

See [Extending DortDB](../guides/extending/functions-and-aggregates.md) for how
extensions work and how to write your own.

## Next step

Continue to [Your First Query](./first-query.md) to construct an engine and run
a query.
