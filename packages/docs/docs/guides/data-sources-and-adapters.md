---
sidebar_position: 2
title: Data Sources & Adapters
description: Register in-memory data and adapt each language to its shape.
---

# Data Sources & Adapters

## Registering sources

[`registerSource`](../api/@dortdb/core/default-export/classes/DortDB.md#registersource)
pairs an in-memory value with a name. It does not copy or convert anything — it
is a constant-time operation, so you can register large structures freely.

```ts
db.registerSource(['users'], usersArray);
db.registerSource(['crm', 'invoices'], invoicesArray); // namespaced name
db.registerSource(['social'], graph);
```

The name is an array of parts, which lets you namespace sources. **Anything**
can be registered — an array, an object, a DOM document, a graph — because it is
the language's _data adapter_ that decides how to read it.

## Data adapters

An adapter is the bridge between a language and the concrete shape of your data.
Each provided language ships with a sensible default, and each can be pointed at
a different shape by supplying your own adapter in the language's config.

| Language | Default adapter                                                                                       | Expects                             |
| -------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------- |
| SQL      | [`ObjectDataAdapter`](../api/@dortdb/lang-sql/default-export/classes/ObjectDataAdapter.md)            | array of objects; property = column |
| Cypher   | [`GraphologyDataAdapter`](../api/@dortdb/lang-cypher/default-export/classes/GraphologyDataAdapter.md) | a Graphology graph                  |
| XQuery   | [`DomDataAdapter`](../api/@dortdb/lang-xquery/default-export/classes/DomDataAdapter.md)               | a DOM document / XML tree           |

### SQL: object rows, or your own accessor

By default SQL treats each array element as a row and each property as a column.
To read differently-shaped rows — say, `Map`-backed rows — supply an adapter
with a
[`createColumnAccessor`](../api/@dortdb/lang-sql/default-export/interfaces/SQLDataAdapter.md#createcolumnaccessor):

```ts
const db = new DortDB({
  mainLang: SQL({
    adapter: {
      createColumnAccessor: (prop) => (row: Map<string, unknown>) =>
        row.get(prop),
    },
  }),
  optimizer: { rules: defaultRules },
});

db.registerSource(
  ['users'],
  [
    new Map([
      ['name', 'Alice'],
      ['age', 30],
    ]),
    new Map([
      ['name', 'Bob'],
      ['age', 25],
    ]),
  ],
);

db.query('SELECT name, age FROM users WHERE age > 30');
// data: [{ name: 'Alice', age: 30 }]
```

### Cypher: the graph adapter

The default Graphology adapter expects node **labels** and edge **types** under
the
[`gaLabelsOrType`](../api/@dortdb/lang-cypher/default-export/variables/gaLabelsOrType.md)
symbol key (see [Cypher Overview](../lang-cypher/overview.md)). Because graphs
can be represented in many ways, the adapter is the seam where you would plug in
a different graph representation.

### XQuery: DOM, or another tree

XQuery's
[`DomDataAdapter`](../api/@dortdb/lang-xquery/default-export/classes/DomDataAdapter.md)
targets DOM/XML. In the browser the global `document` is used automatically; in
Node you pass a document from a DOM implementation. The adapter is also the
mechanism by which XQuery can be retargeted at other tree-shaped data instead of
DOM. See [XQuery Overview](../lang-xquery/overview.md).

## Writing an adapter

Adapters are a first-class extension point. The interfaces differ per language
([`SQLDataAdapter`](../api/@dortdb/lang-sql/default-export/interfaces/SQLDataAdapter.md),
[`XQueryDataAdapter`](../api/@dortdb/lang-xquery/default-export/interfaces/XQueryDataAdapter.md),
[`CypherDataAdapter`](../api/@dortdb/lang-cypher/default-export/interfaces/CypherDataAdapter.md))
— see the API reference for the exact members, and
[Extending DortDB](./extending/overview.md) for how adapters fit into the
broader extension model.
