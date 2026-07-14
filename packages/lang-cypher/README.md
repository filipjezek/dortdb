# @dortdb/lang-cypher

A Cypher-based query language plug-in for
[DortDB](https://github.com/filipjezek/dortdb). It adds data-selection queries
for **property graphs**: data best expressed as nodes connected by
relationships, with visual ASCII-art pattern matching and variable-length paths.

The language is a set of implementation extensions to Cypher, based on the
[openCypher](https://opencypher.org/) grammar (see
[License and attribution](#license-and-attribution) below).

## Installation

```sh
npm install @dortdb/core @dortdb/lang-cypher graphology
```

`@dortdb/core` and [`graphology`](https://graphology.github.io/) are peer
dependencies; `graphology` backs the default data adapter.

## Usage

```ts
import { DortDB } from '@dortdb/core';
import { defaultRules } from '@dortdb/core/optimizer';
import { Cypher, gaLabelsOrType } from '@dortdb/lang-cypher';
import { MultiDirectedGraph } from 'graphology';

const db = new DortDB({
  mainLang: Cypher({ defaultGraph: 'social' }),
  optimizer: { rules: defaultRules },
});

const graph = new MultiDirectedGraph();
graph.addNode('alice', { [gaLabelsOrType]: ['Person'], name: 'Alice', age: 30 });
graph.addNode('bob', { [gaLabelsOrType]: ['Person'], name: 'Bob', age: 20 });
graph.addEdge('alice', 'bob', { [gaLabelsOrType]: 'KNOWS' });

db.registerSource(['social'], graph);

db.query('MATCH (p:Person) RETURN p.name AS name ORDER BY name');
```

## Data adapter

The default adapter queries [Graphology](https://graphology.github.io/) graphs.
It expects node **labels** and edge **types** under the `gaLabelsOrType`
symbol-keyed attribute (`{ [gaLabelsOrType]: ['Person'] }` for a node,
`{ [gaLabelsOrType]: 'KNOWS' }` for a relationship). A plain `labels` property is
not recognized, so label and type patterns like `(:Person)` would silently match
nothing.

Set the graph to query with the `defaultGraph` option, or per query with a
`FROM` clause:

```cypher
FROM myOtherGraph
MATCH (n)
RETURN n
```

## Dialect

The parser accepts the full openCypher 9 grammar, but, in keeping with DortDB's
data-selection focus, only the **read** subset is executed. Data-writing clauses
(`CREATE`, `MERGE`, `SET`, `REMOVE`, `DELETE`) are rejected during planning.

## License and attribution

This package derives from the openCypher grammar, which is licensed under the
Apache License, Version 2.0, and was created by the collective efforts of the
openCypher community.

This work is not approved by the public consensus process of the openCypher
Implementers Group. In keeping with the openCypher attribution terms, it is
described as **implementation extensions to Cypher**, not as "Cypher" or
"openCypher". Cypher® is a registered trademark of Neo4j, Inc.

See the [`NOTICE`](https://github.com/filipjezek/dortdb/blob/main/packages/lang-cypher/NOTICE)
file for the full attribution, and
[`src/parser/cypher.pegjs`](https://github.com/filipjezek/dortdb/blob/main/packages/lang-cypher/src/parser/cypher.pegjs)
for the licensed grammar.

## Documentation

See the [Cypher overview](https://filipjezek.github.io/dortdb/docs/lang-cypher/overview)
and [dialect reference](https://filipjezek.github.io/dortdb/docs/lang-cypher/dialect),
or the full docs at
[filipjezek.github.io/dortdb](https://filipjezek.github.io/dortdb).
