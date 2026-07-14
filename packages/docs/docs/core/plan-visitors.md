---
sidebar_position: 2
title: Plan Visitors
description:
  The per-language visitor passes that traverse and transform the logical plan.
---

# Plan Visitors

Everything the engine does with a logical plan (inferring dependencies,
renaming attributes, building executable
[`Calculation`](../formalism/operators.md#calculation)s, and finally running the
query) is implemented as a **visitor** over the plan tree. Understanding these
visitors is mostly relevant when you
[author a language](../guides/extending/authoring-a-language.md) that introduces
its **own plan operators**: each new operator must be handled by every visitor,
so the language provides its own visitor implementations.

## How dispatch works

Every
[`PlanOperator`](../api/@dortdb/core/default-export/interfaces/PlanOperator.md)
carries a `lang` tag, and its
[`accept()`](../api/@dortdb/core/default-export/interfaces/PlanOperator.md#accept)
method takes a **dictionary of visitors keyed by language**:

```ts
accept<Ret, Arg>(visitors: Record<string, PlanVisitor<Ret, Arg>>, arg?: Arg): Ret;
```

When an operator accepts a visitor map, it looks up the entry for its own `lang`
and calls the matching `visitXxx` method. Dispatch therefore keys on **two**
things: the operator's _type_ (which `visitXxx` runs) and the operator's
_language_ (which visitor in the map runs it). The `lang` tag is the language
that **instantiated** the operator, not necessarily the language a given
operator _type_ comes from. A [`Selection`](../formalism/operators.md#selection)
built by the SQL plan builder is tagged `sql` and handled by SQL's visitor; the
very same core operator type built by XQuery is tagged `xquery` and handled by
XQuery's visitor, all within one traversal. This is the
[extended visitor pattern](./architecture.md#extending-the-algebra-the-visitor-pattern):
it is what lets a language add operators, or change how existing ones are
treated, without touching the core.

Every registered language must therefore supply visitors that implement the
**full**
[`PlanVisitor<Ret, Arg>`](../api/@dortdb/core/default-export/interfaces/PlanVisitor.md)
interface (one `visitXxx` method per operator type) for the operators it can
produce. Writing all of them by hand would be tedious, so in practice a language
**subclasses the corresponding core visitor**, inheriting every `visitXxx`
method and overriding only those for the operators it adds or wants to handle
differently. (The `Ret`/`Arg` types differ per pass.) When a language provides
no visitor for a pass at all, the core visitor handles that language's operators
directly, which is fine as long as the language introduced no new operator types
that pass would encounter.

## The visitor passes

A language descriptor's
[`visitors`](../api/@dortdb/core/default-export/interfaces/Language.md#visitors)
map provides these implementations (see
[`PlanVisitors`](../api/@dortdb/core/default-export/interfaces/PlanVisitors.md)).
Most have a working default in [`@dortdb/core`](../api/@dortdb/core/index.md)
that handles the core operators; you only need to override a pass if your
language adds operators or needs different behavior.

| Visitor                  | Purpose                                            | Provide it when...                                          |
| ------------------------ | -------------------------------------------------- | ----------------------------------------------------------- |
| `LogicalPlanBuilder`     | Turns the parsed AST into an initial plan          | **Always**; it is the entry point of a language             |
| `Executor`               | Evaluates the plan and yields result items         | **Always**, if the language's operators can be a query root |
| `CalculationBuilder`     | Folds expression subtrees into one callable        | You add new operators, or want to modify behavior           |
| `TransitiveDependencies` | Finds identifiers bound in an outer scope          | Same as above                                               |
| `AttributeRenamer`       | Applies a rename map to a subtree                  | Same as above                                               |
| `AttributeRenameChecker` | Pre-checks whether a rename is safe                | Same as above                                               |
| `EqualityChecker`        | Structural equality of two subtrees                | Same as above                                               |
| `VariableMapper`         | Resolves names to numeric indices for the executor | Same as above                                               |

### LogicalPlanBuilder

The
[`LogicalPlanBuilder`](../api/@dortdb/core/default-export/interfaces/LogicalPlanBuilder.md)
is the one visitor that runs over the **AST**, not the plan. Its
[`buildPlan`](../api/@dortdb/core/default-export/interfaces/LogicalPlanBuilder.md#buildplan)
lowers a parsed query into [unified-algebra](../formalism/algebra.md) operators.
Unlike the other passes it has no core default; every language must supply one,
and it is the only visitor that is strictly required to register a language.

It also participates in cross-language **schema inference**. When a language is
nested inside another, the outer language may not yet know the schema of a
source the inner query references. The builder receives such identifiers tagged
with the [`toInfer`](../api/@dortdb/core/default-export/variables/toInfer.md)
symbol in its context, and returns the concrete identifiers it discovered so
inference can complete across the language boundary. See
[Schema inference across scopes](../guides/extending/authoring-a-language.md#3-schema-inference-across-scopes).

### CalculationBuilder

The
[`CalculationBuilder`](../api/@dortdb/core/default-export/classes/CalculationBuilder.md)
collapses a tree of expression operators
([`FnCall`](../formalism/operators.md#fncall),
[`Literal`](../formalism/operators.md#literal), and so on) into a single
[`Calculation`](../formalism/operators.md#calculation): one callable with a
clearly specified set of inputs. This is where **constant folding** happens: a
pure function called with constant arguments is evaluated once, at plan time,
and replaced by its result. If your language adds operators that can appear
inside an expression, this pass needs to know how to compile them.

### TransitiveDependencies

The
[`TransitiveDependencies`](../api/@dortdb/core/default-export/classes/TransitiveDependencies.md)
visitor computes, for each subtree, the set of identifiers it uses but that are
**bound in an outer scope** (its free variables). The optimizer relies on this
to decide, for example, whether a subquery is correlated or whether a
[`Selection`](../formalism/operators.md#selection) can be pushed past a
[`Join`](../formalism/operators.md#join). Results are cached per operator, so
any pass that mutates the plan (notably the renamer) must invalidate the cache
for the changed subtree.

### AttributeRenamer & AttributeRenameChecker

These two cooperate whenever the optimizer needs to rename attributes, most
prominently during
[`Selection` pushdown](../formalism/optimization.md#pushdown-selections), where
a predicate must be rewritten to match renamed columns underneath a
[`Projection`](../formalism/operators.md#projection).

- [`AttributeRenameChecker`](../api/@dortdb/core/default-export/classes/AttributeRenameChecker.md)
  answers _"would applying this rename map be safe?"_ and rejects renames that
  would shadow or collide with existing attributes.
- [`AttributeRenamer`](../api/@dortdb/core/default-export/classes/AttributeRenamer.md)
  applies the rename map to a subtree in place, then invalidates the affected
  transitive-dependency caches.

Any operator that stores attribute references must handle both passes so renames
stay correct through it.

### EqualityChecker

The
[`EqualityChecker`](../api/@dortdb/core/default-export/classes/EqualityChecker.md)
tests two plan subtrees for **structural equality**, optionally ignoring the
`lang` tag or applying a rename map before comparing. Optimizer rules use it to
recognize equivalent expressions. Provide an implementation for new operators
the optimizer may compare.

### VariableMapper

Before execution, the
[`VariableMapper`](../api/@dortdb/core/default-export/classes/VariableMapper.md)
rewrites named identifiers into **numeric indices** scoped to each operator's
output, which the executor uses for fast, name-free lookups. Operators that
introduce or read variables need to participate so their bindings are indexed
correctly.

### Executor

The [`Executor`](../api/@dortdb/core/default-export/classes/Executor.md)
evaluates the final plan, pulling result items **lazily** through the operator
tree (see the [execution model](./architecture.md#execution-model)). The core
default is abstract; a language must provide a concrete implementation for
[`generateTuplesFromValues`](../api/@dortdb/core/default-export/classes/Executor.md#generatetuplesfromvalues),
as well as
[`visitItemSource`](../api/@dortdb/core/default-export/classes/Executor.md#visititemsource).

## Wiring it up

A language descriptor lists its visitor implementations in the
[`visitors`](../api/@dortdb/core/default-export/interfaces/Language.md#visitors)
map, keyed by pass name. You include a pass whenever the language's operators
need it; each implementation is typically a **subclass of the matching core
visitor**, so it inherits the handling of every core operator and only overrides
the methods for its own:

```ts
class MyLangCalcBuilder extends CalculationBuilder {
  // override only the visitXxx methods for MyLang's own operators
}

export function MyLang(config?: MyLangConfig): Language<'mylang'> {
  return {
    name: 'mylang',
    // ...parser, serializer, functions...
    visitors: {
      logicalPlanBuilder: MyLangPlanBuilder, // required
      executor: MyLangExecutor, // required
      calculationBuilder: MyLangCalcBuilder, // needed once you add new operators
      // ...other passes your operators participate in...
    },
  };
}
```

The provided language packages
([`@dortdb/lang-sql`](../api/@dortdb/lang-sql/index.md),
[`@dortdb/lang-cypher`](../api/@dortdb/lang-cypher/index.md),
[`@dortdb/lang-xquery`](../api/@dortdb/lang-xquery/index.md)) are the best
worked references; for example, XQuery extends these visitors to handle its
[`TreeJoin`](../formalism/operators.md#treejoin) operator.
