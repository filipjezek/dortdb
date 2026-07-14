# @dortdb/datetime

A date/time extension for [DortDB](https://github.com/filipjezek/dortdb), a
modular framework for querying JavaScript data structures. It also serves as a
worked example of how a DortDB [extension](https://filipjezek.github.io/dortdb/docs/guides/extending/functions-and-aggregates)
bundles extra functions.

## Installation

```sh
npm install @dortdb/core @dortdb/datetime
```

`@dortdb/core` is a peer dependency.

## Functions

- `now()`: returns the current date as a JavaScript `Date`.
- `interval(string)`: parses an interval string and returns a corresponding interval object.
- `date.add(Date | Interval, Interval)`: adds an interval to a date and returns the result. It can also sum two intervals.
- `date.sub(Date | Interval, Interval)`: subtracts an interval from a date and returns the result. It can also compute the difference between two intervals.
- `date.extract(Date, string)`: extracts a component (such as year, month, or day) from a date.

## Usage

Pass the extension when constructing the engine. This example pairs it with SQL:

```ts
import { DortDB } from '@dortdb/core';
import { datetime } from '@dortdb/datetime';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
  extensions: [datetime],
});

db.query(`
  SELECT date.extract(date.sub(now(), interval('3 years')), 'year') AS y
`);
```

## Documentation

See [Functions & Aggregates](https://filipjezek.github.io/dortdb/docs/guides/extending/functions-and-aggregates)
for how extensions work and how to write your own, or the full docs at
[filipjezek.github.io/dortdb](https://filipjezek.github.io/dortdb).
