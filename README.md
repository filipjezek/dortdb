<!-- prettier-ignore-start -->

# DortDB

DortDB is a modular framework for querying JavaScript data structures.

## Main features

- Highly modular architecture
- Configurable query languages
- Multi-language queries
- Extensible query optimizer

See the live [demo](https://filipjezek.github.io/dortdb/)!

## Installation

Install the core package:

```
npm i @dortdb/core
```

Install the language packages you need:

### Available languages

- [SQL](https://github.com/filipjezek/dortdb/tree/main/packages/lang-sql) (`@dortdb/lang-sql`)
- [Cypher](https://github.com/filipjezek/dortdb/tree/main/packages/lang-cypher) (`@dortdb/lang-cypher`)
- [XQuery](https://github.com/filipjezek/dortdb/tree/main/packages/lang-xquery) (`@dortdb/lang-xquery`)

## Basic example

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

// configure the db
const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: [defaultRules] },
});

const users = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 },
];

// register the data
db.registerSource(['users'], users);

// query!
const result = db.query(`
  SELECT name, age
  FROM users
  WHERE age > 30
`);
```

## Multiple languages

DortDB allows you to combine multiple query languages in a single query.
This makes it possible to leverage the strengths of each language for different parts of your query.

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';
import { XQuery } from '@dortdb/lang-xquery';

// configure the db
const db = new DortDB({
  mainLang: SQL(),
  additionalLangs: [XQuery()],
  optimizer: { rules: [defaultRules] },
});

db.registerSource(['users'], [/* ... */]);
db.registerSource(
  ['invoices'],
  new DOMParser().parseFromString('...')
);

const result = db.query(`
  SELECT name, age
  FROM users
  WHERE age > 30 AND (
    LANG xquery
    fn:count($invoices/[customer = $users:name])
  ) > 5
`);
```

### Language switching

Use language switch blocks to move between languages within a single query.

- A switch typically starts with the `LANG` keyword followed by the language name.
- Switches can appear anywhere a subquery or other atomic expression is allowed.
- A language block ends when its containing scope ends, such as a closing parenthesis.

### Nesting languages

- Languages can be nested to any depth.
- Inner queries can reference values from outer language scopes.
- Internally, all languages are translated into the same [unified algebra](algebra.md).
- The unified operator tree is then optimized and executed as a whole.

## Data adapters

DortDB decouples query languages from the underlying data by letting each language use configurable data adapters to interface with different data sources.

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

// configure the db
const db = new DortDB({
  mainLang: SQL({
    adapter: {
      createColumnAccessor: (prop) => (
        row: Map<string | symbol | number, unknown>
      ) => row.get(prop),
    },
  }),
  optimizer: { rules: [defaultRules] },
});

// use maps instead of objects
const users = [
  new Map([['name', 'Alice'], ['age', 30]]),
  new Map([['name', 'Bob'], ['age', 25]]),
  new Map([['name', 'Charlie'], ['age', 35]]),
];

// register the data
db.registerSource(['users'], users);

// query!
const result = db.query(`
  SELECT name, age
  FROM users
  WHERE age > 30
`);
```

## Secondary indices

To speed things up, DortDB supports secondary indices. These additional data structures enable faster lookups on specific fields.

```ts
import { DortDB, MapIndex } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

// configure the db
const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: [defaultRules] },
});

// register the data
db.registerSource(['users'], [/* ... */]);

// create a secondary index on the "age" field
db.createIndex(['users'], ['age'], MapIndex);
// the indexed expression may be any expression
// that does not include subqueries
db.createIndex(['users'], ['name[0] + age'], MapIndex);
```

### Hash joins

Secondary index classes can also speed up joins over non-indexed data streams in some cases.
For example, `MapIndex` can accelerate joins based on equality conditions. Each index class
defines which expressions it can support. Configure the `Executor` with the available index classes.

```ts
import { DortDB, MapIndex } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: [defaultRules] },
  executor: { hashJoinIndices: [MapIndex] },
});
```

## Language extensions

DortDB lets you define custom operators and functions for your query languages. A datetime extension is included out of the box.

```ts
import { DortDB, datetime } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

// configure the db
const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: [defaultRules] },
  extensions: [datetime],
});
```

### Datetime functions

The datetime extension provides these functions:

- `now()`: Returns the current date as a JavaScript `Date`.
- `interval(string)`: Parses an interval string and returns a corresponding interval object.
- `date.add(Date | Interval, Interval)`: Adds an interval to a date and returns the result. It can also sum two intervals.
- `date.sub(Date | Interval, Interval)`: Subtracts an interval from a date and returns the result. It can also compute the difference between two intervals.
- `date.extract(Date, string)`: Extracts a specific component, such as year, month, or day, from a date.

<!-- prettier-ignore-end -->
