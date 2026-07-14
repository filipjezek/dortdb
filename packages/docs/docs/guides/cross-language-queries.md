---
sidebar_position: 1
title: Cross-language Queries
description: Embed one query language inside another with LANG blocks.
---

# Cross-language Queries

DortDB's defining feature is that a single query can use **more than one
language**. Because every language compiles to the same
[unified algebra](../formalism/algebra.md), a nested language block is not an
opaque call — it becomes part of one plan that is optimized and executed as a
whole. That is what lets the optimizer, for example, push a filter from an outer
SQL query down into an inner Cypher subquery.

To use more than one language, load them all on the engine:

```ts
const db = new DortDB({
  mainLang: SQL(),
  additionalLangs: [Cypher({ defaultGraph: 'social' }), XQuery()],
  optimizer: { rules: defaultRules },
});
```

## Switching languages with `LANG`

Inside a query, a `LANG <name>` block switches to another language. A block can
appear anywhere a subquery or atomic expression is allowed, and it ends when its
enclosing scope ends — typically a closing parenthesis. You can also end a block
explicitly with `LANG EXIT`.

<MulticodeBlock>

```sql
SELECT people.name AS name, friends.cnt AS friend_count
FROM people
JOIN (
  LANG cypher
```

```cypher
  MATCH (p:Person)-[:KNOWS]->(f)
  RETURN p.id AS pid, count(f) AS cnt
```

```sql
) AS friends ON people.id = friends.pid
```

</MulticodeBlock>

Here SQL is the outer language and a Cypher block computes a friend count per
person; the result is joined back like any other subquery.

The outer language can just as easily be Cypher or XQuery. This Cypher query
unwraps rows produced by an inner SQL query:

<MulticodeBlock>

```cypher
UNWIND (
  LANG sql
```

```sql
  SELECT id FROM people ORDER BY name
```

```cypher
) AS pid
RETURN pid
```

</MulticodeBlock>

It is also possible to specify the top-level language like so:

<MulticodeBlock>

```txt
LANG sql
```

```sql
SELECT id FROM people ORDER BY name
```

</MulticodeBlock>

## Referencing the surrounding scope

An inner block can read values from the language scopes that surround it, which
makes correlated subqueries across languages possible. This SQL query keeps only
the people who have more than one friend in the graph, using the outer
`people.id` inside the Cypher block:

<MulticodeBlock>

```sql
SELECT people.name AS name
FROM people
WHERE (
  LANG cypher
```

```cypher
  MATCH (p:Person {id: people.id})-[:KNOWS]->(f)
  RETURN count(f)
```

```sql
) > 1
```

</MulticodeBlock>

### The `nonlocal` prefix (SQL)

In SQL, an unqualified column is assumed to belong to the current `FROM` table.
When SQL is embedded in a language that does not prefix identifiers (such as
Cypher), that assumption gets in the way — you may need to refer to a value from
an outer scope rather than the current table. Prefix the column with the
`nonlocal` schema to do so; DortDB then resolves it against the nearest outer
definition instead of the current table. See
[SQL restrictions](../lang-sql/dialect.md#restrictions-from-the-schemaless-model).

## Tuples vs. items

The unified model has two kinds of data, and it determines what a nested block
gives back to its host:

- **Tuples** are rows with named attributes (relational-style). A block that
  produces tuples can be treated as a table — joined, unwrapped, and so on.
- **Items** are single opaque values (or sequences of them). A block that
  produces items behaves like a scalar or a list.

This is why an embedded SQL or Cypher block can stand in for a table, while an
XQuery block yields a sequence of items rather than rows, and why a
single-column, single-row subquery can be used where a scalar is expected. The
formal treatment is in
[Object Representation](../formalism/object-representation.md).

## Nesting depth

Language blocks nest to any depth, and each inner block can reference values from
any of the scopes above it. The whole nested structure lowers to one operator
tree, so cross-language optimization applies across every boundary rather than
stopping at it.
