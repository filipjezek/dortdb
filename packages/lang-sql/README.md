# @dortdb/lang-sql

A SQL language plug-in for [DortDB](https://github.com/filipjezek/dortdb). It
adds a PostgreSQL-flavored `SELECT` language, the natural choice for
**row-shaped data**: arrays of plain JavaScript objects where each object is a
row and each property is a column.

## Installation

```sh
npm install @dortdb/core @dortdb/lang-sql
```

`@dortdb/core` is a peer dependency.

## Usage

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
});

db.registerSource(
  ['people'],
  [
    { id: 1, name: 'Alice', city: 'Prague' },
    { id: 2, name: 'Bob', city: 'Ankara' },
    { id: 3, name: 'Carol', city: 'Prague' },
  ],
);

db.query(`
  SELECT city, count(*) AS total
  FROM people
  GROUP BY city
  ORDER BY total DESC
`);
// [ { city: 'Prague', total: 2 }, { city: 'Ankara', total: 1 } ]
```

By default SQL reads sources through the `ObjectDataAdapter`, which treats each
array element as a row and each property as a column. You can point SQL at
differently-shaped data (for example `Map`-backed rows) with a custom adapter.

## Dialect

The dialect is based on **PostgreSQL** and covers its data-selection subset,
including several features other SQL flavors lack:

- **Lateral joins**: a `JOIN LATERAL (...)` subquery can reference tables that appear earlier in the `FROM` clause and is re-evaluated per outer row.
- **`DISTINCT ON`**: keep the first row per distinct value of the given expressions rather than deduplicating whole rows.
- **Filtered / ordered aggregates**: `count(...) FILTER (WHERE ...)`, `count(DISTINCT ...)`, and `collect(x ORDER BY x)`.

Identifiers are case-sensitive. There is no data definition or modification
(`CREATE`, `INSERT`, `UPDATE`, ...); DortDB queries data that already exists in
memory.

### Schema-free restrictions

DortDB sources have no declared schema, so queries that would be ambiguous
without one are rejected:

- Unqualified columns require a single, non-joined source; otherwise qualify them (`t1.attr`).
- Natural joins are disabled (there is no schema to infer the join columns from).
- Every `FROM` subquery must have an alias.
- `SELECT *` is not supported.

When embedding SQL inside a language that does not prefix identifiers (such as
Cypher), prefix a column with the `nonlocal` schema to resolve it against the
surrounding scope instead of the current table.

Window functions and grouping-set features (`ROLLUP`, `CUBE`, `GROUPING SETS`)
are not implemented.

## Documentation

See the [SQL overview](https://filipjezek.github.io/dortdb/docs/lang-sql/overview)
and [dialect reference](https://filipjezek.github.io/dortdb/docs/lang-sql/dialect),
or the full docs at
[filipjezek.github.io/dortdb](https://filipjezek.github.io/dortdb).
