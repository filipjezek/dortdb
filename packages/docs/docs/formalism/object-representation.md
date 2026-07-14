---
sidebar_position: 2
title: Unified Object Representation
description: Items, tuples, and streams — the uniform internal representation that abstracts over heterogeneous data models.
---

# Unified Object Representation

Everything that flows through a DortDB plan is one of two things: a **tuple** or an **item**.

- A **tuple** is a row with named attributes, just like a relational tuple. Each attribute name is a sequence of identifiers (for example, a table name plus a column name).
- An **item** is an opaque value. The engine makes no assumptions about its shape or schema — it could be a number, a JSON object, a graph node, or an XML fragment.

Operators consume and produce **streams** of these values. Keeping the representation this small is what lets one algebra serve relational, document, and graph data at once.

## Definitions

The rest of this page is the precise version of the above. You don't need it to use DortDB, but the [Operator Reference](./operators.md) builds on this notation.

### Item

An **item** is an element of an arbitrary, uninterpreted domain $\mathcal{V}$. The engine makes no structural commitments (schema, attribute decomposition, ...) about elements of $\mathcal{V}$ and treats them as opaque.

### Attribute name

An **attribute name** is a finite, non-empty sequence of identifiers $\langle id_1, id_2, \ldots, id_k \rangle$, where each $id_i$ is a non-empty string over a fixed alphabet $\Sigma$. The set of all attribute names is denoted $\mathcal{A}$.

### Tuple

A **tuple** over a finite attribute set $S \subseteq \mathcal{A}$ is a total function

$$
t : S \to \mathcal{V}
$$

The set $S$ together with an attribute ordering $<$ is the **schema** of $t$, written $\mathrm{schema}(t)$. Every tuple an operator produces has the same schema, so we can also talk about the schema of an operator, $\mathrm{schema}(\mathrm{Op})$. The set of all tuples is denoted $\mathcal{T}$.

### Tuple concatenation

Operators that combine rows (joins, projections, ...) glue tuples together with **tuple concatenation**, denoted $\oplus$:

$$
\oplus : \mathcal{T} \times \mathcal{T} \to \mathcal{T}
$$

The combined schema keeps every attribute from both sides, ordered so that the left tuple's attributes come first:

$$
t, u \in \mathcal{T}: \mathrm{schema}(t) \oplus \mathrm{schema}(u) = \left(A_t \cup A_u, <_{tu}\right)
$$

where $<_{tu}$ is defined by:

- $\forall x, y \in A_t: x <_{tu} y \iff x <_t y$ — the left side keeps its order, and comes first;
- $\forall x, y \in A_u \setminus A_t: x <_{tu} y \iff x <_u y$ — then the attributes unique to the right side, in their order.

On values, when both sides share an attribute, the right side wins:

$$
t, u \in \mathcal{T}: t \oplus u = \left\{ (k, v) \in t \mid k \notin \mathrm{dom}(u) \right\} \cup u
$$

### Stream

A **stream** is a possibly infinite, ordered sequence of values of type $X$, denoted $\mathrm{Stream}(X)$. Two refinements show up in operator signatures:

- $\mathrm{Stream}_1(X)$ — produces **exactly one** value.
- $\mathrm{Stream}_{01}(X)$ — produces **one or no** value.

A concrete stream is written with angle brackets, optionally as a comprehension:

$$
\langle a, b, c \rangle \qquad \langle f(x) \mid x \in X \rangle
$$

The set of all streams is denoted $\mathcal{I}$.

## Why not nested relations or property graphs?

**Nested relations** are a well-studied formal model, but they assume you know the full schema of every source up front — which conflicts with DortDB's schema-agnostic design. They also don't fit semi-structured or unstructured data well. Our opaque items handle those cases, while our tuples are essentially relational tuples, so there's still plenty of overlap.

**Property graphs** can model anything, since any data can be drawn as a graph. We chose tuples and items instead, mainly because existing work on XQuery algebra adapted cleanly to our needs.
