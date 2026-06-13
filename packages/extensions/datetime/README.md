# Datetime extension for DortDB

This is a small datetime extension for [DortDB](https://github.com/filipjezek/dortdb) - a modular framework for querying JavaScript data structures.

The datetime extension provides these functions:

- `now()`: Returns the current date as a JavaScript `Date`.
- `interval(string)`: Parses an interval string and returns a corresponding interval object.
- `date.add(Date | Interval, Interval)`: Adds an interval to a date and returns the result. It can also sum two intervals.
- `date.sub(Date | Interval, Interval)`: Subtracts an interval from a date and returns the result. It can also compute the difference between two intervals.
- `date.extract(Date, string)`: Extracts a specific component, such as year, month, or day, from a date.

## Usage

An example configuration of DortDB with SQL and this extension.

```ts
import { DortDB } from '@dortdb/core';
import { datetime } from '@dortdb/datetime';
import { defaultRules } from '@dortdb/core/optimizer';
import { SQL } from '@dortdb/lang-sql';

// configure the db
const db = new DortDB({
  mainLang: SQL(),
  optimizer: { rules: [defaultRules] },
  extensions: [datetime],
});

db.query(`
  SELECT date.sub(now(), interval('3 years'))
`);
```
