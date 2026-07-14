---
sidebar_position: 6
title: Optimization
description:
  The rule-based optimizer, the rewrites it applies, and how secondary indices
  are matched.
---

# Optimization

Because every language is lowered into the [same algebra](./algebra.md), a query
can be optimized **holistically** — the optimizer neither knows nor cares which
language produced which part of the plan. A filter written at the end of an SQL
query can end up pushed deep into a Cypher subtree that came from a nested
`LANG` block, because to the optimizer both are just operators in one tree.

DortDB ships a **rule-based** optimizer. Cost-based optimizers generally do
better, but they need statistics about the data. DortDB sources are schema-less
by design and no statistics are collected, so instead the optimizer is an
**ordered, extensible set of rewrite rules**. Each rule recognizes a pattern in
the plan and replaces it with an equivalent, cheaper subtree.

:::tip[See it in action]

The [Showcase demo](https://filipjezek.github.io/dortdb) lets you toggle and
reorder individual rules and watch the logical plan change — the quickest way to
build intuition for what each rule does.

:::

This page describes the **built-in rules**. To write your own rule for a custom
operator, see [Optimizer Rules](../guides/extending/optimizer-rules.md); for the
practical configuration knobs (indices, hash joins, rule ordering), see
[Indexing & Performance](../guides/indexing-and-performance.md).

## Optimizer-only plan operators

Three operators exist purely to give the optimizer better targets. They are not
part of the theoretical algebra — a plan is complete without them — but they
enable substantial speedups: [`IndexScan`](./operators.md#indexscan),
[`IndexedRecursion`](./operators.md#indexedrecursion), and
[`BidirectionalRecursion`](./operators.md#bidirectionalrecursion). See the
[Operator Reference](./operators.md#tuple-operators--optimizer) for their
signatures and semantics.

## The rules, in default order

The [`defaultRules`](../api/@dortdb/core/optimizer/variables/defaultRules.md)
set applies the following rules in this order. Order matters: several rules
exist to create patterns that a later rule can exploit.

### Unnest Subqueries

Finds [`Calculation`](./operators.md#calculation)s that contain a **safe**
nested subquery and lifts the subquery out in front of the operator as a
[`ProjectionConcat`](./operators.md#projectionconcat), replacing it in the
calculation with a plain reference. A subquery is safe when it produces at most
one value and is always evaluated — so `(SELECT number FROM t) + 5` is unnested,
but `val IN (SELECT number FROM t)` is not (the containing operator accepts a
sequence). Unless the subquery is guaranteed to return a value, the
[`ProjectionConcat`](./operators.md#projectionconcat) is made _outer_.

This rewrite does not speed anything up on its own; it exposes the subquery to
the rules below, which can turn it into a join.

<PlanComparison
  before="/img/optimizer/simple-unnest-subqs-before.svg"
  after="/img/optimizer/simple-unnest-subqs-after.svg"
  label="Unnest Subqueries"
>
  A subquery inside a [`Selection`](./operators.md#selection)'s
  [`Calculation`](./operators.md#calculation) is pulled out as an outer
  [`ProjectionConcat`](./operators.md#projectionconcat).
</PlanComparison>

### Merge To/From Items

A [`MapFromItem`](./operators.md#mapfromitem) sitting directly on top of a
[`MapToItem`](./operators.md#maptoitem) (or vice versa) is redundant. Such pairs
appear routinely after query rewrites and language switches. When
[`MapFromItem`](./operators.md#mapfromitem) is the source and both operators'
keys match, both operators are removed outright; when
[`MapToItem`](./operators.md#maptoitem) is the source, they collapse into a
single-attribute [`Projection`](./operators.md#projection). The only exception
is when the source [`MapToItem`](./operators.md#maptoitem) key is the
[`Symbol(allAttrs)`](../api/@dortdb/core/ast/variables/allAttrs.md). In that
case, the merge is skipped.

<PlanComparison
  before="/img/optimizer/simple-to-from-before.svg"
  after="/img/optimizer/simple-to-from-after.svg"
  label="Merge To/From Items"
>
  Subsequent matching [`MapToItem`](./operators.md#maptoitem) and
  [`MapFromItem`](./operators.md#mapfromitem) are removed.
</PlanComparison>

<PlanComparison
  before="/img/optimizer/simple-from-to-before.svg"
  after="/img/optimizer/simple-from-to-after.svg"
  label="Merge From/To Items"
>
  A [`MapFromItem`](./operators.md#mapfromitem) and a
  [`MapToItem`](./operators.md#maptoitem) collapse into a single-attribute
  [`Projection`](./operators.md#projection).
</PlanComparison>

### Pushdown Selections

A [`Selection`](./operators.md#selection) reduces cardinality, so it pays to
evaluate it as early — as close to the leaves — as possible. This rule moves
[`Selection`](./operators.md#selection)s down the tree, with the constraints
needed to preserve meaning:

- Past [`OrderBy`](./operators.md#orderby) and
  [`Distinct`](./operators.md#distinct) it always moves freely.
- Past set operators ([`Union`](./operators.md#set-operators),
  [`Intersection`](./operators.md#set-operators),
  [`Difference`](./operators.md#set-operators)) it is **duplicated** into both
  branches.
- Past a [`Projection`](./operators.md#projection) only if the predicate does
  not depend on newly computed attributes, and only if the required renaming is
  safe (no variable shadowing) — this is exactly what the
  [attribute rename checker](../core/plan-visitors.md#attributerenamer--attributerenamechecker)
  verifies.
- Into a [`Join`](./operators.md#join),
  [`CartesianProduct`](./operators.md#cartesianproduct), or
  [`ProjectionConcat`](./operators.md#projectionconcat) branch that contains all
  the attributes the predicate needs — but never into the null-padded side of an
  outer join.

To avoid one un-pushable [`Selection`](./operators.md#selection) blocking a
whole chain behind it, the rule considers the **entire chain** of stacked
[`Selection`](./operators.md#selection)s at once and pushes down only the parts
that are eligible.

<PlanComparison
  before="/img/optimizer/simple-sel-pushdown-setop-before.svg"
  after="/img/optimizer/simple-sel-pushdown-setop-after.svg"
  label="Pushdown Selections"
>
  A [`Selection`](./operators.md#selection) duplicated across a set operator.
</PlanComparison>

<PlanComparison
  before="/img/optimizer/simple-sel-pushdown-proj-before.svg"
  after="/img/optimizer/simple-sel-pushdown-proj-after.svg"
  label="Pushdown Selections"
>
  A [`Selection`](./operators.md#selection) pushed below a
  [`Projection`](./operators.md#projection) (with its predicate renamed to
  match).
</PlanComparison>

### ProjectionConcat → Join

A [`ProjectionConcat`](./operators.md#projectionconcat) whose mapping does
**not** depend on the surrounding row (an uncorrelated subquery) is equivalent
to a [`CartesianProduct`](./operators.md#cartesianproduct). If the
[`ProjectionConcat`](./operators.md#projectionconcat) is outer, it becomes a
left outer [`Join`](./operators.md#join) instead. This turns the subqueries
unnested above into ordinary relational operators that later rules and the
executor can handle efficiently.

<PlanComparison
  before="/img/optimizer/simple-proj-concat-to-join-before.svg"
  after="/img/optimizer/simple-proj-concat-to-join-after.svg"
  label="ProjectionConcat → Join"
>
  An uncorrelated, non-outer
  [`ProjectionConcat`](./operators.md#projectionconcat) becomes a plain
  [`CartesianProduct`](./operators.md#cartesianproduct).
</PlanComparison>

### Products → Joins

Merges a [`Selection`](./operators.md#selection) with the
[`CartesianProduct`](./operators.md#cartesianproduct) beneath it into a single
[`Join`](./operators.md#join), moving the predicate into the join condition.
When the [`Selection`](./operators.md#selection) cannot be pushed into either
branch — because it references attributes from both — this is the rewrite that
still makes it useful. Applied to an existing [`Join`](./operators.md#join), it
simply adds another condition rather than combining them into one.

<PlanComparison
  before="/img/optimizer/simple-product-to-join-before.svg"
  after="/img/optimizer/simple-product-to-join-after.svg"
  label="Products → Joins"
>
  A [`Selection`](./operators.md#selection) over a
  [`CartesianProduct`](./operators.md#cartesianproduct) that depends on both
  branches folds into the [`Join`](./operators.md#join) condition.
</PlanComparison>

### Join Indices

The first half of the two-step index handling (described in
[Secondary indices](#secondary-indices) below). It looks for a
[`Join`](./operators.md#join) whose source side is an indexable data source and
whose conditions match a registered index, and rewrites it into a
[`ProjectionConcat`](./operators.md#projectionconcat) shaped so the next rule
can turn the source into an [`IndexScan`](./operators.md#indexscan). In practice
the matched side may also carry chains of
[`Selection`](./operators.md#selection)s, [`OrderBy`](./operators.md#orderby)s,
and [`Projection`](./operators.md#projection)s; index matching sees through
renames and ignores newly computed attributes.

<PlanComparison
  before="/img/optimizer/simple-join-indices-before.svg"
  after="/img/optimizer/simple-join-indices-after.svg"
  label="Join Indices"
>
  A [`Join`](./operators.md#join) whose condition matches an index on its source
  becomes an indexable [`ProjectionConcat`](./operators.md#projectionconcat).
</PlanComparison>

### Index Scans

The second half: a filtered [`TupleSource`](./operators.md#tuplesource) or
[`MapFromItem`](./operators.md#mapfromitem)-wrapped
[`ItemSource`](./operators.md#itemsource) whose
[`Selection`](./operators.md#selection) matches a registered index is replaced
by an [`IndexScan`](./operators.md#indexscan). The scan's access
[`Calculation`](./operators.md#calculation) feeds the matching values straight
into the index structure instead of scanning the whole source. Like
[`Selection`](./operators.md#selection) pushdown, it considers whole
[`Selection`](./operators.md#selection) chains at once.

<PlanComparison
  before="/img/optimizer/simple-index-scans-before.svg"
  after="/img/optimizer/simple-index-scans-after.svg"
  label="Index Scans"
>
  A filtered [`TupleSource`](./operators.md#tuplesource) is replaced by an
  [`IndexScan`](./operators.md#indexscan) driven by an index accessor.
</PlanComparison>

### Merge Projections

The most involved built-in rule. It combines two stacked
[`Projection`](./operators.md#projection)s into one: unused attributes are
dropped, and computed attributes are inlined — **but only when a computed
attribute is referenced once**, so a potentially expensive calculation is never
duplicated. For example, `π([x → a, x → b], π([calc(1+1) → x], ...))` is left
as-is, because merging would evaluate `1+1` twice.

<PlanComparison
  before="/img/optimizer/simple-merge-projs-before.svg"
  after="/img/optimizer/simple-merge-projs-after.svg"
  label="Merge Projections"
>
  Two [`Projection`](./operators.md#projection) nodes collapse into one; the
  intermediate attribute disappears.
</PlanComparison>

## Secondary indices

DortDB lets you register
[custom index types](../guides/extending/custom-indices.md). Because it targets
many data models, indexing is deliberately open-ended: any
[`Calculation`](./operators.md#calculation) that contains no subquery is
indexable. During optimization, registered indices are shown the access
expressions in the plan and decide whether they apply — a hash-table index might
require an equality check on one attribute, while a range index also handles
inequalities. Currently the first matching index wins; this selection lives in
the two replaceable rules above ([Join Indices](#join-indices) and
[Index Scans](#index-scans)), so it can be swapped for a smarter algorithm.

See an example below of how the two rules work together:

```ts
// DortDB programmatic configuration:
db.createIndex(['t2'], ['a + b / 2'], MapIndex);
```

```sql
SELECT t1.foo, t2.bar FROM t1
JOIN t2
ON t2.a + t2.b / 2 = t1.id
```

<PlanComparison
  before="/img/optimizer/tree-index-scan-before.svg"
  after="/img/optimizer/tree-index-scan-after.svg"
  label="Join Indices, Index Scans"
>
  A complete example of the two-step index handling: a
  [`Join`](./operators.md#join) is rewritten into a
  [`ProjectionConcat`](./operators.md#projectionconcat) combined with an
  [`IndexScan`](./operators.md#indexscan) as the source.
</PlanComparison>

This design is what lets Cypher accelerate graph traversal. Graph steps are
lowered into [`Join`](./operators.md#join)s across node and edge sources, which
by themselves ignore the underlying structure. The Cypher
[`ConnectionIndex`](../api/@dortdb/lang-cypher/default-export/classes/ConnectionIndex.md)
detects those [`Join`](./operators.md#join)s via the data adapter's
[`isConnected`](../api/@dortdb/lang-cypher/default-export/interfaces/CypherDataAdapter.md#isconnected)
condition and routes them through the adapter's neighbor-lookup methods instead.
The index stores nothing itself — it is a thin wrapper over the adapter — and it
is what makes [`IndexedRecursion`](./operators.md#indexedrecursion) and
[`BidirectionalRecursion`](./operators.md#bidirectionalrecursion) possible for
graph queries.

## Calculation building & language-specific rewrites

Two more optimizations happen outside the rule list.

**Constant folding** occurs while
[`Calculations` are built](../core/plan-visitors.md#calculationbuilder): a
_pure_ function whose arguments are all constants is evaluated once at plan time
and replaced by its result, avoiding redundant work at execution time.

Because all languages share one algebra, optimizations that target a single
language are rare — it is usually better to write a rule that applies
universally. The exceptions live in the language packages, not the core. SQL,
for instance, rewrites **quantified comparisons** during plan building: a
`> ALL (...)` or similar subquery is replaced by an aggregation over the
subquery, e.g.

```sql
SELECT x FROM a WHERE x < ALL (SELECT y FROM b)
-- is evaluated as:
SELECT x FROM a WHERE x < (SELECT min(y) FROM b)
```
