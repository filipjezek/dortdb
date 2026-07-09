---
sidebar_position: 1
title: Overview
description: How DortDB translates every language into one formal algebra over a unified object representation.
---

# Formalism

DortDB runs every supported language on a single engine. To make that possible, each language frontend is translated into **one shared algebra** that operates on **one shared data representation**. Nothing in the core is tied to SQL, XQuery, or Cypher specifically — they are all just producers of the same operator trees.

Two practical things fall out of this design:

- **You can mix languages in one query.** A `LANG` block hands a subproblem to another frontend, and the result plugs straight back into the surrounding plan. See [Cross-language Queries](../cross-language-queries.md) for the user-facing side.
- **You can extend the engine without forking it.** A language package can add its own operators by implementing visitors, with no changes to the core. See [Extensibility](./algebra.md#extensibility).

## Where to go next

| Page | What it covers |
| --- | --- |
| [Unified Object Representation](./object-representation.md) | The *items*, *tuples*, and *streams* that flow between operators |
| [Unified Algebra](./algebra.md) | Operator context, instantiation, plan visualization, and how the operators fit together |
| [Operator Reference](./operators.md) | Every operator, with a plain-language description plus its signature and formal semantics |
| [Language Mapping](./language-mapping.md) | How SQL, XQuery, and Cypher are lowered into the algebra |

## How language switching works

Language switching is built on the idea behind Virtuoso's SPASQL: a subquery written in one language can be embedded in another. The tricky part is the boundary — different languages expect different shapes of result.

DortDB handles this by recognizing **two kinds of results**:

- **Tuple-producing subqueries** return rows with named attributes, like a relational subquery.
- **Item-producing subqueries** return opaque values, which suits languages such as XPath that don't deal in tuples at all.

Each frontend converts a nested result into whatever shape it needs. For example, SQL sometimes wants a whole row set and sometimes a single scalar:

```sql
-- The subquery here produces tuples
SELECT attr1, attr2 FROM (
  -- subquery
);

-- The inner SELECT here produces a single value
SELECT (SELECT count(*) FROM table1) AS total, count(*)
FROM table1
GROUP BY item_id;
```

### Marking a nested block

A nested block starts with the `LANG` keyword and ends at the enclosing scope (a closing bracket or parenthesis) or at an explicit `LANG EXIT`. The nested language can read variables from the surrounding scope:

```sql
SELECT id, ARRAY(
  LANG cypher
  MATCH (:person {id: people.id})-[:KNOWS]->(friend)
  RETURN friend
) AS friends
FROM people
```

Here the Cypher block reads `people.id` from the outer SQL query.

### Schema inference across boundaries

In schema-driven languages like SQL, the attributes a nested block references are used to **infer the schema of the relations it touches**. In the example below, the SQL parser learns the shape of `foo` from how the nested XQuery and SQL blocks use it:

```sql
SELECT foo.frst, (
  LANG xquery
  for $x in $xs
  return $foo:second + (
    LANG sql
    SELECT foo.third FROM bar
  )
) AS nested
FROM foo
```

:::info
The engine produces a logical plan for queries like this, which you can inspect in the GUI. In those diagrams, the grey brackets on a node show that operator's tuple schema. See [Plan visualization](./algebra.md#plan-visualization).
:::
