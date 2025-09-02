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

## Differences between DortDB and openCypher

The DortDB Cypher language is parsed with an LALR(1) parser, which is not powerful enough for the original openCypher grammar, as it has only a limited lookahead. The grammar contains constructs that would be ambiguous during parsing. Certain patterns are, therefore, parsed a certain way, even though it means that some otherwise valid queries will fail.

### Node patterns or parenthesized expressions

If the input can be interpreted as either the start of a node pattern or a
parenthesized expression, the parser will _always_ choose the node pattern.

- `(a)` is a node pattern
- `(a:Label)` is a node pattern
- `({prop: value)}` is a node pattern
- `($param)` is a node pattern

Because of this, `(a:Label = true)` will cause a parsing error, because it is already considered a node pattern, even though it would be a valid expression in the original grammar, checking whether the `a` variable has the `Label` label. The same goes for `(prop: value.prop)`. More complex parenthesized expressions starting with a variable or a parameter are not affected, for example, `($param = true)` or `(a + a)` are valid expressions.
This should not cause any issues, as it is always possible to interpret the input as expressions by removing the parentheses. The label check expression `a:Label` has the highest precedence, so parentheses would not do anything anyway, and the rest are simply parentheses around atomic expressions.

### Operators

The following symbol combinations are considered a part of relationship patterns and will _not_ be interpreted as operators. If necessary, it is always possible to clarify the meaning by adding parentheses.

- `<-[ (e.g., it will never be parsed as a comparison like a < -[b])`
- `<--`
- `--`
- `-[`

### List/pattern comprehension or list literals

Cypher includes special syntax for list comprehension and pattern comprehension.

```cypher
RETURN [x IN range(0,10) WHERE x % 2 = 0 | x^3] AS result
```

```cypher
MATCH (a:Person)
RETURN [(a)-[:KNOWS]->(b) WHERE b:Person | b.name] AS friends
```

```cypher
MATCH (a {id: 1})
RETURN [path = (a)-[:KNOWS*]->(b) | size(path)] AS foafDistances
```

If the input can be interpreted as either the start of a list/pattern comprehension or a list literal, the parser will always choose the list/pattern comprehension. More specifically, if the input starts with:

- `[variable IN`
- `[variable = (pattern)`

Then it is no longer possible to interpret it as a list literal (even though in the original grammar, `[variable IN list1, variable IN list2]` would be a valid list literal containing two booleans).

### Reserved words

In addition to the regular reserved words, the following words need to be
escaped before they can be used as identifiers.

- `COUNT`
- `ANY`
- `NONE`
- `SINGLE`
