---
sidebar_position: 1
title: Extension Model
description: The extension points DortDB exposes and how they fit together.
---

# Extension Model

Extensibility is a core goal of DortDB — the provided languages are built on the
same public extension points that are available to you. You can add behavior at
several levels, from a single function to an entire language, without forking the
engine.

| You want to add...                        | Do this                       | Guide                                                      |
| ----------------------------------------- | ----------------------------- | ---------------------------------------------------------- |
| a function, operator, aggregate, or cast  | bundle it as an **extension** | [Functions & Aggregates](./functions-and-aggregates.md)    |
| a way to read a differently-shaped source | write a **data adapter**      | [Data Sources & Adapters](../data-sources-and-adapters.md) |
| a specialized access structure            | write an **index type**       | [Custom Index Types](./custom-indices.md)                  |
| a plan rewrite                            | write an **optimizer rule**   | [Optimizer Rules](./optimizer-rules.md)                    |
| a whole query language                    | write a **language plug-in**  | [Authoring a Language](./authoring-a-language.md)          |

## Extensions

The lightest extension point is an **extension**: a bundle of operators,
functions, aggregates, and castables that you register on the engine.

```ts
interface Extension {
  schema?: string; // name prefix applied to everything in the bundle
  operators?: Operator[];
  functions?: Fn[];
  aggregates?: AggregateFn[];
  castables?: Castable[];
  scope?: string[]; // limit the bundle to specific languages
}
```

You pass extensions when constructing the engine:

```ts
new DortDB({
  mainLang: SQL(),
  optimizer: { rules: defaultRules },
  extensions: [datetime, myExtension],
});
```

Use `scope` to make a bundle available only to certain languages (e.g. aggregates
that only make sense in Cypher), and `schema` to namespace its members. Note that
only some languages support user-defined **operators** — SQL, for example.

## Extending the algebra

The deeper extension points — new index types, new optimizer rules, and new
languages — often involve new **plan operators**. The core processes plans with
an [extended visitor pattern](../../core/architecture.md#extending-the-algebra-the-visitor-pattern):
a plan operator's [`accept()`](../../api/@dortdb/core/default-export/interfaces/PlanOperator.md#accept)
takes a dictionary of visitors keyed by language, and each operator is dispatched
to the visitor of the language that instantiated it. A language implements the
full visitor interface — typically by subclassing the core visitor and overriding
only its own operators — which is what lets the algebra grow without changes to
the core. See [Plan Visitors](../../core/plan-visitors.md) for the passes a
language must handle. The formal description of the operators lives in the
[Formalism](../../formalism/algebra.md) section.
