---
sidebar_position: 5
title: Authoring a Language
description: The pieces required to add a whole new query language.
---

# Authoring a Language

Adding a language is the most involved extension point. This page outlines the
pieces involved; the provided language packages ([`@dortdb/lang-sql`](../../api/@dortdb/lang-sql/index.md),
[`@dortdb/lang-cypher`](../../api/@dortdb/lang-cypher/index.md), [`@dortdb/lang-xquery`](../../api/@dortdb/lang-xquery/index.md)) are the best worked references, and
a language is registered exactly like the provided ones: as [`mainLang`](../../api/@dortdb/core/default-export/interfaces/DortDBConfig.md#mainlang) or in
[`additionalLangs`](../../api/@dortdb/core/default-export/interfaces/DortDBConfig.md#additionallangs).

## 1. A parser that cooperates with language switching

The parser turns query text into an AST. Because any language can be nested
inside any other, a parser must handle **language switches**: when it encounters
a `LANG <name>` block it hands off to another parser, and it must know when to
**stop**, even with input remaining, either at an explicit `LANG EXIT` keyword or
when it would leave its own scope (for example a closing parenthesis).

The parser therefore returns both the parsed AST **and any unparsed remainder**,
so an outer parser can resume. For example, parsing the nested block in:

```sql
SELECT t1.attr1 FROM (
  LANG newlang
  -- new language here...
) AS t1 WHERE attr1 > 3
```

the nested parser should stop at the `)` and return the remaining
`) AS t1 WHERE attr1 > 3` to the SQL parser.

## 2. Building the logical plan

From the AST, the language builds an initial [logical plan](../../formalism/algebra.md).
If the unified algebra is not enough, the language may define **new plan
operators**, but it must then handle them in **every visitor pass** the engine
runs over the plan (dependency analysis, renaming, execution, and so on). The
full set of passes, what each one does, and default implementations are covered
in [Plan Visitors](../../core/plan-visitors.md). A language is described by a
descriptor whose `visitors` map provides these implementations:

```ts
export function MyLang(config?: MyLangConfig): MyLangLanguage {
  return {
    name: 'mylang',
    // ...parser, serializer, data adapter...
    visitors: {
      attributeRenamer: MyLangAttributeRenamer, // extends the core AttributeRenamer
      // ...one per core visitor...
    },
  };
}
```

## 3. Schema inference across scopes

When building a plan, a language receives an [`IdSet`](../../api/@dortdb/core/default-export/type-aliases/IdSet.md) of identifiers defined in the
**outer** context. Some of those identifiers may end with the [`Symbol(toInfer)`](../../api/@dortdb/core/default-export/variables/toInfer.md)
token, meaning they belong to a source whose schema is still being inferred. If
the language references any such identifiers, it should record them and return
them alongside the plan, so schema inference can complete across the language
boundary.

## Related building blocks

A language typically also provides a [data adapter](../data-sources-and-adapters.md)
(how it reads registered values) and a serializer (how internal results become
plain JavaScript values), and it may ship [functions](./functions-and-aggregates.md),
[index types](./custom-indices.md), and [optimizer rules](./optimizer-rules.md)
for its operators.
