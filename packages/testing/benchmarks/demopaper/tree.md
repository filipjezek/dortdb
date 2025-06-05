# Tree visualizer

Each node of the tree corresponds to a logical plan operator. The root of the tree is the final query, while its leaves are the individual data sources. Tuple operators have the operator output schema on their nodes. There are two basic types of edges connecting the nodes - solid and dashed. Solid edge means the parent is bound to an existing data stream, while the dashed means that the child will be created (or reevaluated) multiple times. As an example, consider the following SQL query:

```sql
SELECT foo, (SELECT bar FROM bars WHERE bars.id = foos.foo) FROM foos
```

If we do not apply any optimalizations and parse the query as is, we will get the following plan (simplified):

```
projection([
    "foo",
    projection(["bar"], selection(..., "bars"))
], "foos")
```

The edges from the outer projection to `foos` or from the inner projection to the selection will be solid. The edge from the outer to the inner projection will be dashed, because the inner projection stream must be reevaluated based on the `foo` column for each row.
