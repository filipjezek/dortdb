## 2.0.1 (2026-05-22)

### 🩹 Fixes

- MapIndex now handles equality checks properly (i.e. not strictly) ([b55ef43](https://github.com/filipjezek/dortdb/commit/b55ef43))

### ❤️ Thank You

- Filip Ježek @filipjezek

# 2.0.0 (2026-05-18)

### 🚀 Features

- cypher peggy parser - according to benchmarks, peggy is about twice as fast as jison - the resulting parser is also slightly smaller - most importantly, the new parser can process the full openCypher grammar, so there is no longer need for any workarounds or exceptions ([739c992](https://github.com/filipjezek/dortdb/commit/739c992))
- XQuery peggy parser ([51f765f](https://github.com/filipjezek/dortdb/commit/51f765f))
- SQL peggy parser ([e564b6f](https://github.com/filipjezek/dortdb/commit/e564b6f))
- SQL non-recursive CTEs ([12454ed](https://github.com/filipjezek/dortdb/commit/12454ed))
- SQL recursive CTEs ([d420a97](https://github.com/filipjezek/dortdb/commit/d420a97))
- adaptive bidirectional recursion The executor will do a connected BFS check on the source and target only if the path grows too long ([91b78d0](https://github.com/filipjezek/dortdb/commit/91b78d0))
- hash join in `Executor` It is possible to configure the `Executor` with index classes that can be used in a hash join. The `Executor` falls back on nested loop join if there are no suitable index classes available. ([e35dc18](https://github.com/filipjezek/dortdb/commit/e35dc18))
- SQL `IN` optimization ([214e52e](https://github.com/filipjezek/dortdb/commit/214e52e))

### 🩹 Fixes

- selection pushdown sometimes not working with projections ([08124ed](https://github.com/filipjezek/dortdb/commit/08124ed))
- proper handling of nulls in three-state logic languages ([7b00499](https://github.com/filipjezek/dortdb/commit/7b00499))
- xquery filter expressions not working on other basic expressions ([5616ae1](https://github.com/filipjezek/dortdb/commit/5616ae1))
- SELECT from CTE does not need schema-qualified column names if the CTE is the only FROM item ([253e57a](https://github.com/filipjezek/dortdb/commit/253e57a))
- inference of OrderBy schema in SQL plans ([4cf194e](https://github.com/filipjezek/dortdb/commit/4cf194e))
- fixed bugs when combining ORDER BY with aggregates in cypher ([43a9b91](https://github.com/filipjezek/dortdb/commit/43a9b91))
- SQL set operations on subqueries did not propagate selected attributes ([65e178e](https://github.com/filipjezek/dortdb/commit/65e178e))
- wrongfully detected SQL ambiguous columns ([eac40a4](https://github.com/filipjezek/dortdb/commit/eac40a4))
- bug in groupby execution ([e5cc535](https://github.com/filipjezek/dortdb/commit/e5cc535))
- groupby with no aggregates in SQL should still group items ([f9d9006](https://github.com/filipjezek/dortdb/commit/f9d9006))

### ❤️ Thank You

- Filip Ježek @filipjezek

## 1.1.1 (2026-01-10)

### 🩹 Fixes

- fix executor not seeing external context identifiers ([a0193e3](https://github.com/filipjezek/dortdb/commit/a0193e3))

## 1.1.0 (2026-01-09)

### 🚀 Features

- add bidirectional recursion operator ([5a7677d](https://github.com/filipjezek/dortdb/commit/5a7677d))
- add `type` and `labels` cypher functions ([6d60fd2](https://github.com/filipjezek/dortdb/commit/6d60fd2))
- reachability check in bidi recursion ([15cfa4e](https://github.com/filipjezek/dortdb/commit/15cfa4e))

### ❤️ Thank You

- Filip Ježek @filipjezek

## 1.0.2 (2026-01-05)

This was a version bump only, there were no code changes.

## 1.0.1 (2026-01-05)

### 🩹 Fixes

- several optimizer related bugfixes
- fixed `Calculation` cloning behavior breaking references in `argMeta`
