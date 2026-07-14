---
sidebar_position: 5
title: Language Mapping
description: How SQL, XQuery, and Cypher constructs are lowered into the unified algebra.
---

# Language Mapping

Every frontend lowers its syntax into the same [operators](./operators.md). If you know a language, this page shows you which operators your queries actually run on, and if you're extending DortDB, it shows the patterns to follow.

## SQL

| SQL construct                          | Lowered to                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `UNION` / `INTERSECT` / `EXCEPT`       | [`Union`](./operators.md#set-operators) / [`Intersection`](./operators.md#set-operators) / [`Difference`](./operators.md#set-operators) (with [`Distinct`](./operators.md#distinct) when needed) |
| `SELECT` list                          | [`Projection`](./operators.md#projection)                                                                                                                                                        |
| `WHERE`, `HAVING`                      | [`Selection`](./operators.md#selection)                                                                                                                                                          |
| `FROM`, joins                          | [`TupleSource`](./operators.md#tuplesource), [`CartesianProduct`](./operators.md#cartesianproduct), [`Join`](./operators.md#join)                                                                |
| `GROUP BY`                             | [`GroupBy`](./operators.md#groupby)                                                                                                                                                              |
| `ORDER BY`                             | [`OrderBy`](./operators.md#orderby)                                                                                                                                                              |
| `LATERAL` joins, correlated subqueries | [`ProjectionConcat`](./operators.md#projectionconcat) (or operators nested in a [`Calculation`](./operators.md#calculation))                                                                     |
| `col > ALL(...)`, `ANY(...)`           | [`Quantifier`](./operators.md#quantifier), later rebuilt into a [`Calculation`](./operators.md#calculation)                                                                                      |

A standard block lowers in the obvious way:

```sql
SELECT   attrs
FROM     table
WHERE    cond
GROUP BY attrs
HAVING   cond
ORDER BY attrs
```

becomes a [`Projection`](./operators.md#projection) over [`Selection`](./operators.md#selection) (`HAVING`) over [`GroupBy`](./operators.md#groupby) over [`Selection`](./operators.md#selection) (`WHERE`) over the source, finished with an [`OrderBy`](./operators.md#orderby).

Two things to watch:

- **`ORDER BY` can reference columns that aren't in the `SELECT` list.** When that happens, the original [`Projection`](./operators.md#projection) is widened to carry them and a second [`Projection`](./operators.md#projection) is added after the [`OrderBy`](./operators.md#orderby) to drop them again.
- **Correlated subqueries have two lowerings.** They can become a [`ProjectionConcat`](./operators.md#projectionconcat), or operators nested directly inside the relevant [`Calculation`](./operators.md#calculation)s. The optimizer picks between them.

## XQuery

XML value constructors lower to [`FnCall`](./operators.md#fncall)s (later rebuilt into [`Calculation`](./operators.md#calculation)s), and aggregate functions lower to [`GroupBy`](./operators.md#groupby). FLWOR expressions map clause by clause:

| FLWOR clause | Lowered to                                                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `for`        | [`MapFromItem`](./operators.md#mapfromitem) (plus [`CartesianProduct`](./operators.md#cartesianproduct) for multiple sources, [`ProjectionIndex`](./operators.md#projectionindex) for `at $pos`) |
| `let`        | [`Projection`](./operators.md#projection)                                                                                                                                                        |
| `count`      | [`ProjectionIndex`](./operators.md#projectionindex)                                                                                                                                              |
| `where`      | [`Selection`](./operators.md#selection)                                                                                                                                                          |
| `group by`   | [`GroupBy`](./operators.md#groupby)                                                                                                                                                              |
| `order by`   | [`OrderBy`](./operators.md#orderby)                                                                                                                                                              |
| `return`     | [`ProjectionConcat`](./operators.md#projectionconcat) (the returned value may be a sequence that gets flattened into the output)                                                                 |

Path expressions lower to the XQuery [`TreeJoin`](./operators.md#treejoin) operator, usually with [`Selection`](./operators.md#selection)s for predicates. [`TreeJoin`](./operators.md#treejoin) supplies the focus each step needs: `$fs:dot`, `$fs:position`, and `$fs:last`.

## Cypher

| Cypher construct                | Lowered to                                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node / edge iteration           | `defaultGraph.nodes` / `defaultGraph.edges` [`ItemSource`](./operators.md#itemsource)s                                                                                                   |
| `MATCH`                         | [`ItemSource`](./operators.md#itemsource)s, [`Projection`](./operators.md#projection)s, [`Selection`](./operators.md#selection)s, [`ProjectionConcat`](./operators.md#projectionconcat)s |
| Variable-length paths           | a [recursion](./operators.md#recursion) operator (`BidirectionalRecursion` for best performance)                                                                                         |
| `WITH`, `RETURN`                | [`Projection`](./operators.md#projection) (with [`Limit`](./operators.md#limit), [`Distinct`](./operators.md#distinct), or [`OrderBy`](./operators.md#orderby) as needed)                |
| Aggregates in `WITH` / `RETURN` | [`GroupBy`](./operators.md#groupby)                                                                                                                                                      |
| `UNWIND`                        | [`ItemFnSource`](./operators.md#itemfnsource)                                                                                                                                            |

The default graph name can be set globally when registering the language, or per query via a proprietary `FROM` clause.

A naive `MATCH` built only from [`ProjectionConcat`](./operators.md#projectionconcat)s, [`Selection`](./operators.md#selection)s, and [`ItemSource`](./operators.md#itemsource)s would be far too slow and would ignore the graph's structure entirely. So the optimizer rewrites connected node/edge patterns first into joins, then into index scans backed by a [`ConnectionIndex`](../api/@dortdb/lang-cypher/default-export/classes/ConnectionIndex.md).

:::note[Variable-length path example]

```cypher
MATCH ()-[path *4]->()
RETURN path
```

This selects every node, then finds each node's incoming and outgoing edges with index scans. The [`BidirectionalRecursion`](./operators.md#bidirectionalrecursion) operator expands and stitches those edges into four-segment paths from both ends, and a final [`Selection`](./operators.md#selection) drops paths that reuse an edge (an artifact of joining the forward and backward halves).
:::
