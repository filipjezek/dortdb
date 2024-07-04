# Thoughts

## What is the purpose

- existing application ds can take many forms and we need to be able to query them all
- we need to respect the existing data and not force it into new models
- different languages more suitable for different ds, but the user should not be forced to learn a new language for each ds
- all ds share the same "backend" - the js runtime - therefore no need for bigdawg island migrations

## What do different languages do differently

- each language offers a different set of optimizations
  - e.g. many graph languages offer shortest-path optimization operators, which makes no sense to have in SQL
- can we combine the optimizations of different languages?
- one possible solution is to have common logical operators and then language-specific operators (preferably shared in some way)
  - the subqueries would be optimized first (common operators would be kept as-is), then the result would be further optimized by @dortdb/core
  - the common operators would be the ones that are easy to implement in all languages, e.g. filter, project, join, union, etc.
- not everything that is semantically equivalent could be optimized in the same way
  - e.g. there is a way to implement shortest-path in SQL, but this is very hard to recognize by the query optimizer
  - therefore using a different language for different tasks sometimes matters

## Different kinds of ASTs

1. The original query AST

   - required in order to be able to manipulate the original query programmatically, e.g. prettify it or add new parts to it

2. The logical query plan AST
3. The optimized query plan AST - uses same operators as the logical query plan AST

## Execution

- each logical node should point to the language it comes from
- then a visitor from each language would be used to execute parts of the query
- can we use a common visitor to execute all common operators? E.g. all projections?
  - each language could be specialized for very specific ds, e.g. a special class which stores attributes of its data item in a certain way
  - there would have to be a transformation expressed in a language-specific operator (or possibly a common operator) which would transform the data item from the language-specific format to the common format
