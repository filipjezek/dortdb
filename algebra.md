# Unified algebra

This algebra is used for DortDB logical query plans. It is mostly based on these papers:

- <https://ieeexplore.ieee.org/abstract/document/1617382>
- <https://arxiv.org/abs/2407.04823>

Each language can provide its own operators if neccessary.

## Tuple operators

These operators work with streams of named tuples, e.g. rows of a relation.

| name             | signature                                                                                         | schema           | description                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| distinct         | $\delta(\texttt{attributes}, \texttt{source})$                                                    | source           | Discards duplicate tuples, possibly restricted to `attributes`.                                                                                                                                                   |
| groupBy          | $\gamma(\texttt{keys},\texttt{aggs},\texttt{source})$                                             | keys + aggs      | Groups tuples based on `keys`, for each group emits `keys` and one attribute for each `agg` aggregate. Each aggregate may contain other operators modifying the tuples it receives (e.g selection or orderBy).    |
| cartesianProduct | $\times(\texttt{left},\texttt{right})$                                                            | left + right     | Cartesian product of `left` and `right` streams.                                                                                                                                                                  |
| join             | $\bowtie(\texttt{left},\texttt{right},\texttt{leftOuter},\texttt{rightOuter},\texttt{condition})$ | left + right     | Relational algebra join.                                                                                                                                                                                          |
| orderBy          | $\tau(\texttt{orders},\texttt{source})$                                                           | source           | Orders the `source` stream based on `orders`. Each `order` of `orders` contains an expression as well as direction and `nullsFirst` flag.                                                                         |
| projection       | $\pi(\texttt{attrs},\texttt{source})$                                                             | attrs            | For each `source` tuple emits new tuple consisting of `attrs`, where each `attr` is a named expression.                                                                                                           |
| projectionConcat | $\stackrel{\bowtie}{\rightarrow}(\texttt{mapping}, \texttt{outer}, \texttt{source})$              | source + mapping | Dependent join. For each tuple in `source`, evaluate `mapping` - a separate tuple operator - within the context of the given `source` tuple. Emit all tuples from `mapping` joined with the given `source` tuple. |
| projectionIndex  | $\text{index}(\texttt{name}, \texttt{source})$                                                    | source + (name)  | Introduces a new attribute `name` which contains the ordinal index of each `source` tuple.                                                                                                                        |
| selection        | $\sigma(\texttt{expression}, \texttt{source})$                                                    | source           | Filters `source` tuples based on `expression`.                                                                                                                                                                    |
| recursion        | $\phi(\texttt{min}, \texttt{max}, \texttt{condition}, \texttt{source})$                           | source           | Self-join on `source` done `min` to `max` times. Keeps the schema of `source`, but each of the attributes will be an array.                                                                                       |
| tupleSource      | $\textbf{name}$                                                                                   | unknown          | Named source of tuples.                                                                                                                                                                                           |
| tupleFnSource    | $\textbf{name}(\texttt{params})$                                                                  | possibly unknown | Function generating a tuple stream. May have defined schema.                                                                                                                                                      |
| mapFromItem      | $\text{fromItem}(\texttt{key}, \texttt{source}) $                                                 | (key)            | Converts each item from `source` to a tuple with a single attribute named `key`                                                                                                                                   |

## Item operators

These operators treat all values as opaque items.

| name          | signature                                                          | description                                                                                                                                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| calculation   | $\text{calc}(\texttt{args})$                                       | This operator is used for expressions. One such example would be the condition in `selection`. `args` can be either identifiers or other operators, in which case they are evaluated each time the `calculation` is recomputed. Created by merging intermediate operators mentioned below. |
| conditional   | $\text{cond}(\texttt{expr}, \texttt{whenthens}, \texttt{default})$ | Intermediate step when creating a `calculation` representing a case expression.                                                                                                                                                                                                            |
| fnCall        | $\text{fn}(\texttt{args})$                                         | Intermediate step when creating a `calculation` representing a generic function call. Used e.g. for arithmetic operations.                                                                                                                                                                 |
| literal       | $\text{literal}(\texttt{value})$                                   | Intermediate step when creating a `calculation` representing a literal value.                                                                                                                                                                                                              |
| quantifier    | $\text{quant}(\texttt{type}, \texttt{query})$                      | Intermediate step when creating a `calculation` representing a sql-style quantifier. Used in expressions such as `expr1 > ALL(expr2)`                                                                                                                                                      |
| itemSource    | $\textit{name}$                                                    | Named source of items.                                                                                                                                                                                                                                                                     |
| tupleFnSource | $\textit{name}(\texttt{params})$                                   | Function generating an item stream.                                                                                                                                                                                                                                                        |
| mapToItem     | $\text{toItem}(\texttt{key}, \texttt{source})$                     | Converts each tuple from `source` to an item by either plucking a single attribute `key` or (if not specified) by treating the whole tuple as an item.                                                                                                                                     |

## Universal operators

These operators can act as either tuple or item operators.

| name         | signature                                     | description                                                                     |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------------- |
| union        | $\cup(\texttt{left}, \texttt{right})$         | Concats `left` and `right` streams.                                             |
| intersection | $\cap(\texttt{left}, \texttt{right})$         | Concats `left` and tuples of `right` which are distinct from all `left` tuples. |
| difference   | $\setminus(\texttt{left}, \texttt{right})$    | Emits all tuples of `left` which are distinct from all `right` tuples.          |
| limit        | $\text{limit}(\texttt{skip}, \texttt{limit})$ | Skips first `skip` items and emits only the next `limit` items.                 |
| nullSource   | $\square$                                     | Emits only one null item.                                                       |
