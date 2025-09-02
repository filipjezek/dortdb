# DortDB - SQL

This package is a language plugin for [DortDB](https://github.com/filipjezek/dortdb). It adds support for SQL `SELECT` queries.

## Data adapter

The default data adapter implementation allows queries against iterables of JS objects.

```ts
const t1 = [
  { a: 1, b: 2, c: 3 },
  { a: 4, b: 5, c: 6 },
];
db.registerSource(['t1'], t1);
db.query('SELECT a, b FROM t1');
```

## Dialect

The package is based on the PostgreSQL dialect. For convenience, identifiers _are_ case-sensitive. Only `SELECT` queries are supported.

## Notable features

PostgreSQL includes several features that are not usual in other SQL flavors. Among them belong the following:

### Lateral joins

Lateral joins allow joining of correlated subqueries. In other words, it is possible for the joined subquery to refer to previous tables, and thus to be re-evaluated for
different outer contexts.

```sql
SELECT t1.attr1, s.attr2 FROM t1
JOIN LATERAL (
SELECT t2.attr2 FROM t2
-- the WHERE clause refers to the outer context
-- the subquery is reevaluated for each t1 row
WHERE t2.attr3 + t1.attr4 > t1.attr5
) AS s
```

### DISTINCT ON

The `DISTINCT` modifier filters out duplicate values. PostgreSQL allows customizing this behavior.

```sql
SELECT DISTINCT ON (attr1, attr2 % 10) attr1, attr2, attr3
FROM t1
```

### Complex aggregate calls

The arguments of aggregate calls such as `count` or `sum` may be filtered or sorted.

```sql
SELECT
count(DISTINCT attr1) AS distinct_count,
count(attr1) FILTER (WHERE attr1 % 2 = 0) AS even_count,
collect(attr1 ORDER BY attr1) AS ordered_array
FROM t1
```

## Limitations

Currently, some SQL features are not supported, including:

- window functions
- common table expressions (CTEs)
- special `GROUP BY` behavior (`ROLLUP`, `CUBE`, `GROUPING SETS`)
- any schema-dependent features (read further)

### Schema of data sources

DortDB is by design schema-less. This clashes with some SQL expressions, that only make sense in a schema-based context. Consider the following:

```sql
-- which tables are a, b, or c from?
SELECT a, b, c
-- what columns are used in the natural join?
FROM t1 NATURAL JOIN t2
```

The allowed queries therefore face some restrictions.

- It must be clear from which tables specific columns originate.
- Non-qualified column names are only allowed when there is only a single, non-joined data source.
- Natural joins are disabled.
- All `FROM` clause subqueries must have an alias.
- Selecting all attributes using asterisk \* is currently also disabled, although in theory it should be possible.

When an attribute should not be interpreted as belonging to the current table, it should be prefixed by the `nonlocal` schema. This is relevant when inserting SQL subqueries
into languages that do not prefix identifiers, such as Cypher.

```sql
-- t1.attr1
SELECT attr1 FROM t1
-- t2.attr2, t2.attr3, attr1 from elsewhere
WHERE (SELECT attr2 FROM t1 WHERE attr3 < nonlocal.attr1)
```
