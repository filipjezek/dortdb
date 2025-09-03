<!-- prettier-ignore-start -->

# DortDB

DortDB is a framework for querying JavaScript data structures.

## Main features

- highly modular architecture
- configurable query languages
- multilanguage queries
- extensible query optimizer

See the live [demo](https://filipjezek.github.io/dortdb/)!

## Installation

Install the core package:

```
npm i @dortdb/core
```

Install your languages of choice:

### Currently implemented languages

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
  optimizer: defaultRules,
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
  additionalLangs: [XQuery()]
  optimizer: defaultRules,
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

### Language Switching

You can switch between languages using language switch blocks.

- A switch typically starts with the `LANG` keyword followed by the language name.
- Switches can appear anywhere a subquery (or other atomic expression) would.
- A language block ends when its containing scope ends (e.g. a closing parenthesis).

### Nesting Languages

- Languages can be nested to any depth.
- Inner queries can reference values from outer language scopes.
- Internally, all languages are translated into the same [unified algebra](algebra.md).
- This unified operator tree is then optimized and executed as a whole.

## Data adapters

DortDB aims to provide a way to query _anything_. To achieve this, languages can be configured with data adapters that allow them to interface with different data sources.

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
  optimizer: defaultRules,
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

To speed things up, DortDB supports secondary indices. These are additional data structures that allow for faster lookups on specific fields.

```ts
import { DortDB, MapIndex } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

// configure the db
const db = new DortDB({
  mainLang: SQL(),
  optimizer: defaultRules,
});

// register the data
db.registerSource(['users'], [/* ... */]);

// create a secondary index on the "age" field
db.createIndex(['users'], ['age'], MapIndex);
// the indexed expression may be any expression
// that does not include subqueries
db.createIndex(['users'], ['name[0] + age'], MapIndex);
```

## Language extensions

DortDB allows you to define custom operators and functions for your query languages. A simple datetime extension is provided out of the box.

```ts
import { DortDB, MapIndex, datetime } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

// configure the db
const db = new DortDB({
  mainLang: SQL(),
  optimizer: defaultRules,
  extensions: [datetime],
});
```

### Datetime functions

The datetime extension provides the following functions:

- `now()`: Returns the current date as a JS Date object.
- `interval(string)`: Parses an interval string and returns an object representing the interval.
- `date.add(Date | Interval, Interval)`: Adds an interval to a date and returns the resulting date. Can also sum two intervals.
- `date.sub(Date | Interval, Interval)`: Subtracts an interval from a date and returns the resulting date. Similarly to above, can also compute a difference between two intervals.
- `date.extract(Date, string)`: Extracts a specific component (e.g. year, month, day) from a date.

<!-- prettier-ignore-end -->
