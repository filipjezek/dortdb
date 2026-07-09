---
sidebar_position: 4
title: Operator Reference
description: Every operator of the unified algebra, with a plain-language description, signature, and formal semantics.
---

# Operator Reference

This is the full catalog of operators in the unified algebra. Each entry gives you:

- **what it does**, in plain language;
- its **signature** — the arguments and their types, and what it returns;
- its **semantics** — the precise definition.

Notation used throughout: $\mathcal{V}$ is the domain of items, $\mathcal{T}$ the set of tuples, $\mathcal{A}$ the set of attribute names, $\oplus$ is [tuple concatenation](./object-representation.md#tuple-concatenation), and $\Gamma$ is the [operator context](./algebra.md#operator-context). $\mathrm{inst}_{\dots}$ marks an argument that is re-instantiated per row (a [horizontal input](./algebra.md#instantiation-vertical-vs-horizontal-inputs)).

---

## Item operators

Item operators produce streams of opaque values. Most are _calculation intermediaries_: building blocks assembled inside a [`Calculation`](#calculation) rather than standalone plan nodes.

| Operator                       | Notation                                                             | Result schema |
| ------------------------------ | -------------------------------------------------------------------- | ------------- |
| **Calculation intermediaries** |                                                                      |               |
| AggregateCall                  | $\mathrm{agg}(\texttt{args})$                                        | —             |
| Conditional                    | $\mathrm{cond}(\texttt{expr}, \texttt{whenthens}, \texttt{default})$ | —             |
| FnCall                         | $\mathrm{fn}(\texttt{impl}, \texttt{args})$                          | —             |
| Literal                        | $\mathrm{literal}(\texttt{value})$                                   | —             |
| Quantifier                     | $\mathrm{quant}(\texttt{type}, \texttt{query})$                      | —             |
| **Other**                      |                                                                      |               |
| Calculation                    | $\mathrm{calc}(\texttt{impl}, \texttt{args})$                        | —             |
| ItemSource                     | $\textit{name}$                                                      | —             |
| ItemFnSource                   | $\textit{name}(\texttt{impl}, \texttt{params})$                      | —             |
| MapToItem                      | $\mathrm{toItem}(\texttt{key}, \texttt{source})$                     | —             |

### AggregateCall

Represents the result of a single aggregate (such as `count` or `sum`) applied to a partition produced by an upstream [`GroupBy`](#groupby). It's a placeholder that the [`GroupBy`](#groupby) fills in for each group.

### Conditional

A `CASE` / if-then-else expression. It scans the `whenthens` pairs and returns the value of the first one whose condition matches, falling back to `default`. With an `expr`, each branch is compared against that value (a `switch`); without one, each branch condition is tested for truth (an `if`/`elif` chain).

- **expr**: $\mathrm{Stream}_{01}(\mathcal{V})$
- **whenthens**: $\mathrm{Seq}((\mathrm{Stream}_{01}(\mathcal{V}), \mathrm{Stream}_{01}(\mathcal{V})))$
- **default**: $\mathrm{Stream}_{01}(\mathcal{V})$
- **returns**: $\mathrm{Stream}_{1}(\mathcal{V})$

$$
\mathrm{cond}(e, w, d) = \begin{cases}
\langle w_{i,1}\rangle \text{ where } i \text{ is the first index with } w_{i,0} = e, \text{ else } d, & \text{if } e \text{ is provided} \\[6pt]
\langle w_{i,1}\rangle \text{ where } i \text{ is the first index with } w_{i,0} = \langle\textbf{true}\rangle, \text{ else } d, & \text{otherwise}
\end{cases}
$$

### FnCall

Calls a scalar function on its arguments and yields a single value. It's the building block for ordinary expressions inside a [`Calculation`](#calculation) (arithmetic, comparisons, string functions, and so on).

- **impl**: $\mathrm{Seq}(\mathrm{Stream}(\mathcal{V})) \rightarrow \mathrm{Stream}_1(\mathcal{V})$
- **args**: $\mathrm{Seq}(\mathrm{Stream}(\mathcal{V}))$
- **returns**: $\mathrm{Stream}_{1}(\mathcal{V})$

$$
\mathrm{fn}(i, A) = \langle i(A) \rangle
$$

### Literal

A constant value embedded directly in the plan, such as the `3` in `x + 3`.

### Quantifier

A SQL-style quantified comparison, for example `x > ALL(SELECT y FROM t)` or `x = ANY(...)`. The `type` says how the comparison is quantified over the subquery `query`.

### Calculation

The general "compute a value" operator, and the only item operator that routinely appears as a real plan node. It wraps an expression — function calls, literals, attribute references, even whole subqueries — and evaluates it against the current row and context. [`Projection`](#projection) attributes and [`Selection`](#selection) conditions are all `Calculation`s. When its expression contains a subquery, it tracks whether that subquery yields at most one value or many.

- **impl**: $\mathrm{Seq}(\mathrm{Stream}(\mathcal{V})) \rightarrow \mathrm{Stream}_1(\mathcal{V})$
- **args**: $\mathrm{Seq}(\mathrm{Stream}(\mathcal{V}))$
- **returns**: $\mathrm{Stream}_{1}(\mathcal{V})$

$$
\mathrm{calc}(i, A) = \langle i(A) \rangle
$$

### ItemSource

A named source that emits opaque items — for example a graph's `nodes` or `edges`, or a registered JSON array. The leaf of an item pipeline.

### ItemFnSource

Like [`ItemSource`](#itemsource), but the items come from calling a function with parameters rather than from a named registration. Cypher's `UNWIND` lowers to this.

- **impl**: $\mathrm{Seq}(\mathrm{Stream}_1(\mathcal{V})) \rightarrow \mathrm{Stream}(\mathcal{V})$
- **params**: $\mathrm{Seq}(\mathrm{Stream}_1(\mathcal{V}))$
- **returns**: $\mathrm{Stream}(\mathcal{V})$

$$
\textit{name}(i, A) = i(A)
$$

### MapToItem

Turns a tuple stream into an item stream by pulling the `key` attribute out of each tuple. If `key` is the _allAttrs_ symbol `*`, the whole tuple becomes the item. The bridge from the tuple world back to the item world.

- **key**: $\mathcal{A}$
- **source**: $\mathrm{Stream}(\mathcal{T})$, where $\texttt{key} \in \mathrm{schema}(\texttt{source})$
- **returns**: $\mathrm{Stream}(\mathcal{V})$

$$
\mathrm{toItem}(k, S) = \langle t.k \mid t \in S \rangle
$$

---

## Tuple operators — SPJ and other

Tuple operators produce streams of named rows. These are the relational core of the algebra.

| Operator                    | Notation                                                                                             | Result schema                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Select / Project / Join** |                                                                                                      |                                           |
| CartesianProduct            | $\times(\texttt{left},\texttt{right})$                                                               | $\texttt{left} \oplus \texttt{right}$     |
| Join                        | $\bowtie(\texttt{left},\texttt{right}, \texttt{leftOuter}, \texttt{rightOuter},\texttt{conditions})$ | $\texttt{left} \oplus \texttt{right}$     |
| Projection                  | $\pi(\texttt{attrs},\texttt{source})$                                                                | $\texttt{attrs}$                          |
| ProjectionConcat            | $\stackrel{\bowtie}{\rightarrow}(\texttt{mapping}, \texttt{outer}, \texttt{source})$                 | $\texttt{source} \oplus \texttt{mapping}$ |
| ProjectionIndex             | $\mathrm{index}(\texttt{key}, \texttt{source})$                                                      | $\texttt{source} \oplus (\texttt{key})$   |
| Selection                   | $\sigma(\texttt{expression}, \texttt{source})$                                                       | $\texttt{source}$                         |
| **Other**                   |                                                                                                      |                                           |
| Distinct                    | $\delta(\texttt{attributes}, \texttt{source})$                                                       | $\texttt{source}$                         |
| GroupBy                     | $\gamma(\texttt{keys},\texttt{aggs},\texttt{source})$                                                | $\texttt{keys} \oplus \texttt{aggs}$      |
| MapFromItem                 | $\mathrm{fromItem}(\texttt{key}, \texttt{source})$                                                   | $(\texttt{key})$                          |
| OrderBy                     | $\tau(\texttt{orders},\texttt{source})$                                                              | $\texttt{source}$                         |
| Recursion                   | $\phi(\texttt{min}, \texttt{max}, \texttt{condition}, \texttt{source})$                              | $\texttt{source}$                         |
| TupleSource                 | $\textbf{name}$                                                                                      | unknown                                   |
| TupleFnSource               | $\textbf{name}(\texttt{impl}, \texttt{params})$                                                      | possibly unknown                          |

### CartesianProduct

Pairs every row on the left with every row on the right — the unfiltered cross product.

- **left**: $\mathrm{Stream}(\mathcal{T})$
- **right**: $\mathrm{Stream}(\mathcal{T})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

$$
\times(L, R) = \langle l \oplus r \mid l \in L, r \in R \rangle
$$

### Join

A cross product kept only where all `conditions` hold. Set `leftOuter` or `rightOuter` to also emit unmatched rows from that side, padded with nulls. Conditions are kept as a set (rather than one combined predicate) so the optimizer can reason about each separately; a join with no conditions is legal and useful purely for its outer-join behavior.

- **left**: $\mathrm{Stream}(\mathcal{T})$
- **right**: $\mathrm{Stream}(\mathcal{T})$
- **leftOuter**: Boolean
- **rightOuter**: Boolean
- **conditions**: $\mathrm{Set}(\mathrm{inst}_{\mathrm{Stream}_1(\mathcal{V})})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

$$
\bowtie(L, R, \textbf{false}, \textbf{false}, C, \Gamma) = \langle l \oplus r \mid l \in L, r \in R, \forall c \in C: c(\Gamma \cup l \cup r) = \langle\textbf{true}\rangle \rangle
$$

When `leftOuter` (or `rightOuter`) is true, unmatched left (or right) rows are also returned, padded with nulls.

### Projection

Computes a new set of named attributes for each row — the algebra's `SELECT` list. Each output attribute is a [`Calculation`](#calculation) evaluated against the row and context.

- **attrs**: $\mathrm{Seq}(\mathrm{inst}_{\mathrm{Stream}_1(\mathcal{V})} \times \mathcal{A})$
- **source**: $\mathrm{Stream}(\mathcal{T})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

$$
\pi(A, S, \Gamma) = \langle \left\{ a \mapsto c(\Gamma \oplus s) \mid (c, a) \in A \right\} \mid s \in S \rangle
$$

### ProjectionConcat

The _depend-join_. For each `source` row, it re-evaluates the `mapping` subquery (which may reference that row through the context) and joins each resulting row back onto the source row. This is how correlated subqueries and `LATERAL` joins are expressed. With `outer` set, source rows that produce no mapping rows are still emitted, padded with nulls.

- **mapping**: $\mathrm{inst}_{\mathrm{Stream}(\mathcal{T})}$
- **outer**: Boolean
- **source**: $\mathrm{Stream}(\mathcal{T})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

$$
\stackrel{\bowtie}{\rightarrow}(M, \textbf{false}, S, \Gamma) = \langle s \oplus m \mid m \in M(\Gamma \oplus s), s \in S \rangle
$$

### ProjectionIndex

Adds an attribute holding each row's ordinal position in the stream (its row number).

- **key**: $\mathcal{A}$
- **source**: $\mathrm{Stream}(\mathcal{T})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

$$
\mathrm{index}(k, S) = \langle s_i \oplus \left\{ k \mapsto i \right\} \mid s_i \in S \rangle
$$

### Selection

Keeps only the rows for which the condition is true — the algebra's `WHERE`.

- **expr**: $\mathrm{inst}_{\mathrm{Stream}_1(\mathcal{V})}$
- **source**: $\mathrm{Stream}(\mathcal{T})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

$$
\sigma(E, S, \Gamma) = \langle s \mid s \in S, E(\Gamma \oplus s) = \langle\textbf{true}\rangle \rangle
$$

### Distinct

Removes duplicate rows. Duplicates are compared on `attributes`, which may be the _allAttrs_ symbol `*` to compare whole rows.

### GroupBy

Partitions rows by their `keys` and computes one or more aggregates per partition. Each entry in `aggs` is an aggregate function paired with the attribute it writes; the output of each group is its key values concatenated with its aggregate results.

- **keys**: $\mathrm{Seq}(\mathrm{inst}_{\mathrm{Stream}_1(\mathcal{V})} \times \mathcal{A})$
- **aggs**: $\mathrm{Seq}((\mathrm{Stream}(\mathcal{T}) \rightarrow \mathcal{V}) \times \mathcal{A})$
- **source**: $\mathrm{Stream}(\mathcal{T})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

The helper $\mathrm{group}$ selects the rows belonging to one partition (those whose key values equal $V$):

$$
\mathrm{group}(K, V, S, \Gamma) = \langle s \mid s \in S, \forall i : K_i(\Gamma \oplus s) = V_i \rangle
$$

$$
\begin{aligned}
\gamma(K, A, S, \Gamma) = \langle\ & \{ a \mapsto k(\Gamma \oplus s) \mid (k, a) \in K \}\ \oplus \\
& \{ a \mapsto f(\mathrm{group}(K,\ \langle k(\Gamma \oplus s) \mid (k, \_) \in K \rangle,\ S,\ \Gamma)) \mid (f, a) \in A \} \\
& \mid s \in S\ \rangle_{unique}
\end{aligned}
$$

### MapFromItem

Wraps each opaque item into a single-attribute row named `key` — the inverse of [`MapToItem`](#maptoitem). The original item is stored as-is; it is _not_ reinterpreted as a tuple.

- **key**: $\mathcal{A}$
- **source**: $\mathrm{Stream}(\mathcal{V})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

$$
\mathrm{fromItem}(k, S) = \langle \left\{ k \mapsto s \right\} \mid s \in S \rangle
$$

### OrderBy

Sorts the row stream by the given `orders` (ordering keys with directions). Schema is unchanged.

### Recursion

Repeatedly self-joins `source`, breadth-first, building up paths of length `min` to `max` while `condition` holds. It backs variable-length graph paths and recursive CTEs. Each output attribute accumulates an array of values across the iterations, and `condition` sees, for every attribute, the array accumulated so far together with the candidate next value.

- **min**: $\mathbb{N}$
- **max**: $\mathbb{N}$
- **condition**: $\mathrm{inst}_{\mathrm{Stream}_1(\mathcal{V})}$
- **source**: $\mathrm{Stream}(\mathcal{T})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

Base case — a single step wraps each attribute value in a one-element array:

$$
\phi(0, 1, C, S, \Gamma) = \langle \left\{ a \mapsto \langle s.a \rangle \mid a \in s \right\} \mid s \in S \rangle
$$

Inductive case — extend each accumulated path by one more matching row:

$$
\begin{aligned}
\phi(0, \mathrm{max}, C, S, \Gamma) = \langle\ & \{ a \mapsto \mathrm{acc}.a \cup \langle\mathrm{curr}.a\rangle \mid a \in \mathrm{acc} \} \\
& \mid \mathrm{curr} \in S, \\
& \quad \mathrm{acc} \in \phi(0, \mathrm{max} - 1, C, S, \Gamma), \\
& \quad C(\Gamma \oplus \mathrm{zip}(\mathrm{curr}, \mathrm{acc})) = \langle\textbf{true}\rangle\ \rangle
\end{aligned}
$$

Finally, keep only paths of at least `min` length:

$$
\phi(\mathrm{min}, \mathrm{max}, C, S, \Gamma) = \langle p \mid p \in \phi(0, \mathrm{max}, C, S, \Gamma), \forall a \in p: |p.a| \geq \mathrm{min} \rangle
$$

### TupleSource

A named source that emits rows — for example a registered relational table. Its schema is generally not known until planning resolves it.

### TupleFnSource

Like [`TupleSource`](#tuplesource), but the rows come from calling a function with parameters.

- **impl**: $\mathrm{Seq}(\mathrm{Stream}_1(\mathcal{V})) \rightarrow \mathrm{Stream}(\mathcal{T})$
- **params**: $\mathrm{Seq}(\mathrm{Stream}_1(\mathcal{V}))$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

$$
\mathrm{name}(i, A) = i(A)
$$

---

## Tuple operators — XQuery

These two operators are provided by the XQuery package, not the core. They demonstrate that the algebra is extensible.

| Operator       | Notation                                            | Result schema                                                                      |
| -------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| ProjectionSize | $\mathrm{size}(\texttt{key}, \texttt{source})$      | $\texttt{source} \oplus (\texttt{key})$                                            |
| TreeJoin       | $\mathrm{treeJoin}(\texttt{expr}, \texttt{source})$ | $\texttt{source} \oplus (\texttt{fs.dot}, \texttt{fs.position}, \texttt{fs.last})$ |

### ProjectionSize

Adds an attribute holding the total number of rows in the stream. XQuery needs this to expose `$fs:last` during path navigation.

- **key**: $\mathcal{A}$
- **source**: $\mathrm{Stream}(\mathcal{T})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

$$
\mathrm{size}(k, S) = \langle s \oplus \left\{ k \mapsto |S| \right\} \mid s \in S \rangle
$$

### TreeJoin

Implements an XQuery path step such as `a/b/c`. For each source row it evaluates `expr` and, for every produced item, emits a row carrying the XQuery focus: the current item (`$fs:dot`), its position (`$fs:position`), and the total count (`$fs:last`). It rolls [`ProjectionConcat`](#projectionconcat), [`ProjectionIndex`](#projectionindex), and [`ProjectionSize`](#projectionsize) into one — but unlike [`ProjectionConcat`](#projectionconcat), its `expr` is a [`Calculation`](#calculation), not a tuple operator.

- **expr**: $\mathrm{inst}_{\mathrm{Stream}(\mathcal{V})}$
- **source**: $\mathrm{Stream}(\mathcal{T})$
- **returns**: $\mathrm{Stream}(\mathcal{T})$

$$
\begin{aligned}
\mathrm{treeJoin}(E, S, \Gamma) = \langle\ & s_i \oplus \{ \\
& \quad \langle\mathrm{fs}, \mathrm{dot}\rangle \mapsto e,\ \\
& \quad \langle\mathrm{fs}, \mathrm{position}\rangle \mapsto i,\ \\
& \quad \langle\mathrm{fs}, \mathrm{last}\rangle \mapsto |\mathrm{treeJoin}(E, S, \Gamma)| \\
& \} \mid s_i \in S, e \in E(\Gamma \oplus s_i)\ \rangle
\end{aligned}
$$

---

## Universal operators

Universal operators accept either tuples or items.

| Operator     | Notation                                                           |
| ------------ | ------------------------------------------------------------------ |
| NullSource   | $\square$                                                          |
| Limit        | $\mathrm{limit}(\texttt{offset}, \texttt{limit}, \texttt{source})$ |
| **Set**      |                                                                    |
| Union        | $\cup(\texttt{left}, \texttt{right})$                              |
| Intersection | $\cap(\texttt{left}, \texttt{right})$                              |
| Difference   | $\setminus(\texttt{left}, \texttt{right})$                         |

### NullSource

Emits exactly one empty row. It gives constant queries like `SELECT 1 AS one` something to project from.

- **returns**: $\mathrm{Stream}_1(\mathcal{V} \cup \mathcal{T})$

$$
\square = \langle \varnothing \rangle
$$

### Limit

Skips the first `offset` results, then passes through at most `limit` of them — `OFFSET` plus `LIMIT`.

- **offset**: $\mathbb{N}$
- **limit**: $\mathbb{N}$
- **source**: $\mathrm{Stream}(\mathcal{V} \cup \mathcal{T})$
- **returns**: $\mathrm{Stream}(\mathcal{V} \cup \mathcal{T})$

$$
\mathrm{limit}(o, l, S) = \langle s_i \mid s_i \in S, o < i \leq o + l \rangle
$$

### Set operators

`Union`, `Intersection`, and `Difference` are the standard set operations over two streams. Each takes **left** and **right** of type $\mathrm{Stream}(\mathcal{V} \cup \mathcal{T})$ and returns the same type.

$$
\cup(L, R) = L \cup R
$$

$$
\cap(L, R) = \langle x \mid x \in R \wedge x \in L \rangle
$$

$$
\setminus(L, R) = \langle x \mid x \in L \wedge x \notin R \rangle
$$
