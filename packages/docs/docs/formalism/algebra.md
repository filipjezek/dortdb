---
sidebar_position: 3
title: Unified Algebra
description: Operator context, instantiation, plan visualization, and a tour of every operator group.
---

# Unified Algebra

A parsed query becomes a tree of **operators**. Each operator is a node from the unified algebra; the leaves are data sources and the root is the final result. This is the same algebra for every language — see [Language Mapping](./language-mapping.md) for how each frontend gets here.

Operators come in two families:

- **Tuple operators** work on streams of named tuples, much like relational algebra ([`Selection`](./operators.md#selection), [`Projection`](./operators.md#projection), [`Join`](./operators.md#join), …).
- **Item operators** work on streams of opaque items.

A few operators ([`Limit`](./operators.md#limit), the [set operators](./operators.md#set-operators)) work on either, depending on their input. The design draws on existing algebras for XQuery, graph paths, and nested relations.

The full catalog — with a plain-language description, signature, and formal semantics for each operator — lives in the [Operator Reference](./operators.md). This page explains the concepts you need to read that catalog and the plans the engine produces.

## Operator context

Some operators behave differently depending on the rows flowing through the operators around them. That surrounding state is the **context**, written $\Gamma \in \mathcal{T}$.

Think of $\Gamma$ as the variable scope an operator can see: the data that was available when it was created, plus the most recent tuples from its direct tuple-producing inputs. A correlated subquery, for instance, reads the outer row from its context.

Walking a small plan top to bottom, the context each operator receives is:

1. A bottom [`TupleSource`](./operators.md#tuplesource) gets no context.
2. A [`Selection`](./operators.md#selection) (and the [`Calculation`](./operators.md#calculation) in its condition) gets the latest tuple from its source.
3. A source feeding off that [`Selection`](./operators.md#selection) gets the [`Selection`](./operators.md#selection)'s latest tuple.
4. A [`Projection`](./operators.md#projection) over a correlated subquery gets the concatenation of the latest tuples from both inputs.

In short: context flows down the tree, accumulating the rows each operator's ancestors have produced.

## Instantiation: vertical vs. horizontal inputs

Operators differ in **how often their inputs are (re)created**, and this distinction drives both execution and how plans are drawn.

- Most inputs are created **once** and reused for the operator's whole life. These are **vertical inputs** ($\mathrm{vertical}(\mathrm{Op})$). Example: the `source` of a [`Selection`](./operators.md#selection). [`CartesianProduct`](./operators.md#cartesianproduct) likewise builds its `left` and `right` streams once.
- Some inputs are **recreated repeatedly** as the context changes — once per incoming row. These are **horizontal inputs** ($\mathrm{horizontal}(\mathrm{Op})$). Example: a correlated subquery inside a [`Selection`](./operators.md#selection) condition.

Formally, a horizontal input is a function from context to a stream:

$$
\mathrm{stream} \subseteq \mathcal{I}, \quad \mathrm{inst}_{stream}: \mathcal{T} \rightarrow \mathrm{stream}
$$

You'll see the $\mathrm{inst}$ notation in operator signatures wherever an argument is re-instantiated per row.

## Plan visualization

The DortDB GUI draws each plan as a tree. The root is the final query, the leaves are data sources, and nodes are colored by the language they came from. Tuple-operator nodes also show their schema (the grey brackets).

Edges tell you the instantiation kind at a glance:

- **Solid edge** — the child is created once, with its parent (a vertical input).
- **Dashed edge** — the child is recreated many times during the parent's life (a horizontal input).

For example, in `SELECT x + 3 AS xplusthree FROM table1`, the [`TupleSource`](./operators.md#tuplesource) **table1** is created once (solid), while the [`Calculation`](./operators.md#calculation) for `x + 3` is re-evaluated per row (dashed) and points at the attribute it produces, `xplusthree`.

:::tip Try it
The GUI is live at [filipjezek.github.io/dortdb](https://filipjezek.github.io/dortdb). Type a query and watch the plan build.
:::

## A tour of the operator families

For exact semantics, jump to the [Operator Reference](./operators.md). This section gives you the lay of the land.

### Item operators

Most item operators are **calculation intermediaries** — they never appear as standalone plan nodes. Instead they are the pieces a [`Calculation`](./operators.md#calculation) is built from.

[`Calculation`](./operators.md#calculation) is the workhorse: it represents _any computed value_, such as a projection expression or a selection condition. Its arguments can be attribute references or even whole plan operators, which is how subqueries get embedded into an expression. When a subquery is involved, the [`Calculation`](./operators.md#calculation) records whether it should yield at most one value or many.

The remaining item operators are data sources and [`MapToItem`](./operators.md#maptoitem), which pulls one attribute out of each tuple to turn a tuple stream into an item stream.

:::note Subqueries and the optimizer
A subquery starts life as a [`Calculation`](./operators.md#calculation) wrapping a [`Projection`](./operators.md#projection). The optimizer can lift that into an outer [`ProjectionConcat`](./operators.md#projectionconcat), and — if the subquery doesn't depend on the outer row — further into a plain left outer [`Join`](./operators.md#join). Same result, progressively cheaper plans.
:::

### Tuple operators

These are the familiar relational operators — [`Selection`](./operators.md#selection), [`Projection`](./operators.md#projection), [`Join`](./operators.md#join), [`CartesianProduct`](./operators.md#cartesianproduct), [`OrderBy`](./operators.md#orderby) — plus a few that earn their own mention:

- **[`ProjectionConcat`](./operators.md#projectionconcat)** (a.k.a. _depend-join_) re-runs a subquery for each source row and joins the results back. It's how correlated subqueries and `LATERAL` joins are expressed.
- **[`GroupBy`](./operators.md#groupby)** partitions rows by key and runs aggregates per partition. Each aggregate can carry its own filtering, ordering, or distinctness:

  ```sql
  SELECT
    count(id) FILTER (WHERE sex = 'M') AS men,
    count(id) FILTER (WHERE sex = 'F') AS women,
    collect(DISTINCT id ORDER BY id) AS all_ids
  FROM sales
  GROUP BY brand
  ```

- **[`Recursion`](./operators.md#recursion)** is a self-join repeated up to `max` times, executed breadth-first so the shortest results come out first. It powers variable-length graph paths and recursive CTEs.

### XQuery-specific operators

[`ProjectionSize`](./operators.md#projectionsize) and [`TreeJoin`](./operators.md#treejoin) ship with the XQuery package, not the core — they're the concrete proof that the algebra is extensible. [`TreeJoin`](./operators.md#treejoin) implements path steps like `a/b/c`, exposing the XQuery focus (`$fs:dot`, `$fs:position`, `$fs:last`) for each step.

### Universal operators

[`Union`](./operators.md#set-operators), [`Intersection`](./operators.md#set-operators), [`Difference`](./operators.md#set-operators), and [`Limit`](./operators.md#limit) all work on tuples or items alike. [`NullSource`](./operators.md#nullsource) emits a single empty row, which is what gives a constant query like `SELECT 1 AS one` something to project from.

## Extensibility

The core algebra covers everything DortDB does today, but a new language might need more. When it does, **adding an operator is just defining its behavior** — you extend the relevant visitor classes inside your language package, and the core stays untouched. The XQuery operators above are built exactly this way.
