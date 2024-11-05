# Differences from openCypher 9

## Differences due to a lack of lookahead

We use a LALR(1) parser, so in the original grammar there are some constructs that would be ambiguous
during parsing.

### Node patterns vs parenthesized expressions

If the input can be interpreted as either a start of a node pattern, or a parenthesized expression,
the parser will always choose the node pattern.

- `(a)` is a node pattern
- `(a:Label)` is a node pattern
- `({prop: value})` is a node pattern
- `($param)` is a node pattern

Because of this, `(a:Label = true)` will cause a parsing error, because it is already considered a node pattern,
even though it would be a valid expression in the original grammar. Same goes for `({prop: value}.prop)`. Parenthesized
expressions starting with a variable or a parameter are not affected by this, so `($param = true)` or `(a + a)` are valid expressions.

This should not cause any issues in your code, as you can always remove the parentheses if you want it to be an expression.
`a:Label` has the highest precedence, so parentheses would not do anything anyway, and the rest are simply parentheses around
atomic expressions.

### Operators

The following symbol combinations are considered parts of relationship patterns and will not be interpreted as operators.
This should not matter in practice unless there are extensions in use which add meaning to these potential operations.

- `<-[` (e.g. you cannot do `a < -[b]` and expect it to be parsed as a comparison)
- `<--`
- `-[` (e.g. you cannot do `[a] - [b]` and expect it to be parsed as a subtraction)
- `--`

### List/Pattern comprehension vs list literals

If the input can be interpreted as either a start of a list/pattern comprehension or a list literal, the parser will always choose
the list/pattern comprehension. More specifically, if the input starts with:

- `[variable IN`
- `[variable = (pattern)`

it is no longer possible to interpret it as a list literal (even though in the original grammar `[variable IN list1, variable IN list2]`
would be a valid list literal containing two booleans).

### Reserved words

In addition to the regular reserved words, the following words need to be escaped as well before they can be used as identifiers:

- COUNT
- ANY
- NONE
- SINGLE
