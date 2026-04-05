---
sidebar_position: 2
title: Cross-language Queries
description: Use LANG blocks to compose SQL, XQuery, and Cypher in one query plan.
---

# Cross-language Queries

Cross-language composition is one of DortDB's central ideas. The `LANG` switch lets a query delegate a subproblem to another language frontend while keeping one runtime and one planning pipeline.

This approach is intentionally different from designing a brand-new universal query language. Instead, each subproblem is expressed in the language that fits its data model best.

## Mental Model

Each language package contributes parsing and language-specific visitors. The core engine still owns:

- source registration
- logical planning
- optimizer passes
- execution context
- result serialization

This makes nested language blocks composable and optimizable, rather than feeling like separate isolated database calls.

## What Gets Shared Across LANG Blocks

When entering a nested `LANG` block, DortDB keeps:

- the same source registry
- the same outer variable scope (where semantically valid)
- the same optimization and execution pipeline

So language switching changes syntax and semantics of the subquery, but not the overall runtime context.

## SQL Calling Cypher

This pattern works well when the outer shape is tabular, but one predicate or projection is graph-specific.

```sql
SELECT id, firstName
FROM customers
WHERE EXISTS (
  LANG cypher
  MATCH (:person {id: customers.id})<-[:hasCreator]-(post)-[:hasTag]->({id: 52})
  RETURN 1
)
```

The Cypher block can reference `customers.id` from the outer SQL scope.

## Cypher Calling XQuery

This pattern is useful when graph traversal identifies candidate entities and XML data verifies or enriches them.

```cypher
MATCH (:person {id: 4659})-[:knows]->(person)<-[:hasCreator]-()-[:hasTag]->(tag)
WHERE EXISTS {
  LANG xquery
  $Invoices/Invoices/Invoice.xml[PersonId=$person/@id]/Orderline[brand="Reebok"]
}
RETURN DISTINCT tag.id
```

Here the XQuery block sees the Cypher variable `person` and uses its `id` attribute while walking the invoice document.

## SQL Calling XQuery and Cypher Together

DortDB can nest more than one language in the same statement. One realistic pattern is to compute relational candidates in SQL, enrich them from XML with XQuery, and measure graph activity with Cypher.

```sql
SELECT x.value->'id' AS productId,
       x.value->'sales' AS sales,
       x.value->'popularity' || '%' AS popularity
FROM (
  LANG xquery
  let $categoryProducts := (
    LANG sql
    SELECT products.productId
    FROM products
    JOIN brandProducts ON products.asin = brandProducts.productAsin
    JOIN vendors ON brandProducts.brandName = vendors.id
    WHERE vendors.Industry = 'Sports'
  )
  return $categoryProducts
) x
```

The exact nesting shape depends on the surrounding language grammar and the expected result shape at each boundary.

## Scope Rules

When a `LANG` block appears inside another query:

- the nested block can read values from the outer scope
- the nested block runs against the same registered source registry
- the result shape still has to make sense to the outer language

In practice that means:

- SQL usually expects a scalar, row set, or `EXISTS`-compatible subquery
- Cypher often uses `EXISTS { ... }`, `UNWIND`, or projected expressions
- XQuery can treat nested blocks as sequence-producing expressions

If a nested result shape does not match what the outer expression expects, the query will fail at planning or execution time.

## Practical Constraints

Cross-language querying is powerful, but there are real boundaries:

- not every feature from each language specification is implemented
- type and schema assumptions differ between SQL, XQuery, and Cypher
- value conversion between tuple and sequence-oriented contexts can require explicit shaping

In practice, it is best to keep each nested block focused and explicit about what it returns.

## When To Use It

Use `LANG` switches when they reduce impedance between data models. Good examples:

- SQL joins object-like sources, then calls Cypher for friend-of-friend traversal
- Cypher finds subgraphs, then calls XQuery to inspect XML payloads
- XQuery extracts values from documents, then calls SQL for grouping or sorting

Do not use it just because you can. If the whole problem fits one frontend cleanly, staying in one language keeps the query easier to read.

## Related Pages

- [Design Goals](./design-goals.md)
- [Core Overview](./core/overview.md)
- [SQL Overview](./lang-sql/overview.md)
- [XQuery Overview](./lang-xquery/overview.md)
- [Cypher Overview](./lang-cypher/overview.md)
