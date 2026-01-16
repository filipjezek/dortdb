# DortDB - Cypher Language Partial Implementation

This package is a language plugin for [DortDB](https://github.com/filipjezek/dortdb). It adds support for [Cypher](https://opencypher.org/) data selection queries.

## Data adapter

The default data adapter implementation allows queries against [Graphology](https://graphology.github.io/) graphs. The language can be configured with the name of the default graph to query.

```ts
const lang = Cypher({
  defaultGraph: 'myGraph',
});
```

It is also possible to specify the queried graph in the query itself:

```cypher
FROM myOtherGraph
MATCH (n)
RETURN n
```
