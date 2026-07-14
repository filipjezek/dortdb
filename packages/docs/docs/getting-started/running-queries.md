---
sidebar_position: 3
title: Running Queries
description: query() versus parse/buildPlan/executePlan, streaming, and bound parameters.
---

# Running Queries

[`db.query()`](../api/@dortdb/core/default-export/classes/DortDB.md#query) is the convenient one-shot path, but DortDB exposes each stage of
the pipeline so you can inspect or transform a query along the way. The stages
are:

1. **[`parse`](../api/@dortdb/core/default-export/classes/DortDB.md#parse):** query text → AST nodes.
2. **[`buildPlan`](../api/@dortdb/core/default-export/classes/DortDB.md#buildplan):** AST → an optimized logical plan of algebra operators.
3. **[`executePlan`](../api/@dortdb/core/default-export/classes/DortDB.md#executeplan):** plan → results (streamed lazily).

[`query()`](../api/@dortdb/core/default-export/classes/DortDB.md#query) simply runs all three and materializes the output.

## One-shot: `query()`

```ts
const result = db.query('SELECT a FROM t');
result.data; // materialized array
result.schema; // ['a']
```

Use this whenever you just want results. Note that if a query text contains
multiple statements, only the **last** statement is executed.

## Step by step

### `parse`

[`parse`](../api/@dortdb/core/default-export/classes/DortDB.md#parse) returns an **array** of AST nodes — one per top-level statement:

```ts
import { ASTNode } from '@dortdb/core';

const ast: ASTNode[] = db.parse('SELECT a FROM t');
const last = ast.at(-1);
```

### `buildPlan`

[`buildPlan`](../api/@dortdb/core/default-export/classes/DortDB.md#buildplan) translates one AST node into a logical plan and runs the optimizer
on it. The returned object is a plan operator tree; every operator exposes
[`getChildren()`](../api/@dortdb/core/default-export/interfaces/PlanOperator.md#getchildren) for quick traversal, and both AST nodes and plan operators
implement the visitor pattern for more structured processing.

```ts
import * as plan from '@dortdb/core/plan';

const p = db.buildPlan(ast.at(-1));

// Example: flip every ORDER BY direction without writing a full visitor
const stack = [p];
while (stack.length) {
  const current = stack.pop();
  stack.push(...current.getChildren());
  if (current instanceof plan.OrderBy) {
    for (const o of current.orders) {
      o.ascending = !o.ascending;
    }
  }
}
```

### `executePlan`

[`executePlan`](../api/@dortdb/core/default-export/classes/DortDB.md#executeplan) runs a plan and returns a result whose `data` is a **lazy
iterable** rather than a materialized array:

```ts
const result = db.executePlan(p);

for (const row of result.data) {
  // rows are produced on demand
  if (done(row)) break; // stop early without computing the rest
}
```

This is the difference between [`executePlan`](../api/@dortdb/core/default-export/classes/DortDB.md#executeplan)
and [`query`](../api/@dortdb/core/default-export/classes/DortDB.md#query): [`query`](../api/@dortdb/core/default-export/classes/DortDB.md#query) eagerly
collects `data` into an array, while [`executePlan`](../api/@dortdb/core/default-export/classes/DortDB.md#executeplan) streams it. Streaming lets
you process large results incrementally or stop early. To materialize a streamed
result, spread or collect it: `const rows = [...result.data]`.

:::note[Synchronous execution]
Execution is synchronous and single-threaded — iterating `data` pulls rows
through the operator tree on the calling thread. Functions and aggregates used in
queries must therefore be synchronous.
:::

## Bound parameters

Pass runtime values into a query with `boundParams` instead of interpolating
them into the query string. Parameters are referenced by name; the syntax
depends on the language:

- **SQL** uses `:name` (or `?name`).
- **Cypher** and **XQuery** use `$name`.

```ts
// SQL
db.query('SELECT n FROM nums WHERE n > :threshold', {
  boundParams: { threshold: 15 },
});

// Cypher
db.query('MATCH (a) WHERE a.id > $id RETURN a', {
  mainLang: 'cypher',
  boundParams: { id: 13 },
});
```

`boundParams` works with [`query`](../api/@dortdb/core/default-export/classes/DortDB.md#query),
and the underlying [`executePlan`](../api/@dortdb/core/default-export/classes/DortDB.md#executeplan) accepts the
same parameter map as its second argument.

## Summary

| Method                                                                                           | Returns                                                                         | Data               | Use when                               |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------ | -------------------------------------- |
| [`query(text, opts?)`](../api/@dortdb/core/default-export/classes/DortDB.md#query)               | [`QueryResult`](../api/@dortdb/core/default-export/interfaces/QueryResult.md)   | materialized array | you just want results                  |
| [`parse(text, opts?)`](../api/@dortdb/core/default-export/classes/DortDB.md#parse)               | [`ASTNode[]`](../api/@dortdb/core/ast/interfaces/ASTNode.md)                    | —                  | you need the AST                       |
| [`buildPlan(ast, opts?)`](../api/@dortdb/core/default-export/classes/DortDB.md#buildplan)        | [`PlanOperator`](../api/@dortdb/core/default-export/interfaces/PlanOperator.md) | —                  | you want to inspect/transform the plan |
| [`executePlan(plan, params?)`](../api/@dortdb/core/default-export/classes/DortDB.md#executeplan) | [`QueryResult`](../api/@dortdb/core/default-export/interfaces/QueryResult.md)   | lazy iterable      | you want streaming / early exit        |
