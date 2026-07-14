---
sidebar_position: 4
title: Optimizer Rules
description: Write a plan-rewrite rule for the rule-based optimizer.
---

# Optimizer Rules

The optimizer applies an ordered list of **rewrite rules** to the logical plan.
Each rule recognizes a pattern in the plan and replaces it with an equivalent,
cheaper one. Writing a rule is especially useful alongside a
[custom plan operator](./authoring-a-language.md), but rules can be as simple as
removing a redundant pair of operators.

## The `PatternRule` interface

A rule reduces to a starting operator plus two methods:

- **[`operator`](../../api/@dortdb/core/optimizer/interfaces/PatternRule.md#operator)** — the plan-operator class (or classes) the rule starts matching
  at, or `null` to consider every node.
- **[`match(node)`](../../api/@dortdb/core/optimizer/interfaces/PatternRule.md#match)** — test whether the pattern applies at `node`; return the
  captured bindings, or `null` if it does not apply.
- **[`transform(node, bindings)`](../../api/@dortdb/core/optimizer/interfaces/PatternRule.md#transform)** — return the rewritten plan operator.

```ts
interface PatternRule<T extends PlanOperator, U> {
  operator: (new (...args: any[]) => T) | (new (...args: any[]) => T)[] | null;
  match(node: T): { bindings: U } | null;
  transform(node: T, bindings: U): PlanOperator;
}
```

The provided rules range from small local rewrites (removing neighboring
[`MapFromItem`](../../api/@dortdb/core/plan/classes/MapFromItem.md) /
[`MapToItem`](../../api/@dortdb/core/plan/classes/MapToItem.md) operators) to larger algorithms (merging
[`Projection`](../../api/@dortdb/core/plan/classes/Projection.md)s). The [default rule set](../indexing-and-performance.md#optimizer-configuration)
is a good source of examples.

## Registering a rule

Rules are just entries in the optimizer's ordered `rules` array — order matters,
so place a new rule where it should run relative to the others. A rule that needs
the database interface can be provided as a class (the optimizer instantiates it,
see [`PatternRuleConstructor`](../../api/@dortdb/core/optimizer/interfaces/PatternRuleConstructor.md)):

```ts
new DortDB({
  mainLang: SQL(),
  optimizer: { rules: [...defaultRules, MyRule] },
});

// or swap the rule set at runtime
db.optimizer.reconfigure({ rules: [MyRule] });
```
