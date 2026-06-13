# TSDoc conventions for public packages

Applies to every **public and protected** member of the public npm packages:
`@dortdb/core`, `@dortdb/lang-sql`, `@dortdb/lang-xquery`, `@dortdb/lang-cypher`
(the `datetime` extension is deferred). Docs are consumed by TypeDoc → the
Docusaurus API reference and by IDE hovers, so write for a caller who can see
the signature but not the implementation.

The authoritative list of what still needs a comment is
`tools/tsdoc/undocumented.worklist.txt`, regenerated with
`tools/tsdoc/typedoc.validate.json`. The goal is zero `notDocumented` warnings.

## Golden rule: document the contract, not the syntax

Explain **what it's for, what it guarantees, and anything a caller can't infer
from the types** - preconditions, side effects, ownership, units, edge cases,
performance characteristics. Never restate the signature in prose.

```ts
// BAD - adds nothing the type didn't already say
/** Sets the name. @param name the name */
setName(name: string): void;

// GOOD - states the contract
/**
 * Registers the source under `name`, replacing any existing source with the
 * same name. The name is matched case-sensitively.
 */
setName(name: string): void;
```

## Tag set

TypeDoc uses **TSDoc**, so use `{@link Target}` for cross-references (not
`[text]()`), and `{@inheritDoc}` to pull a base member's docs into an override.

Use a tag only when it carries information beyond the obvious:

- `@param` / `@returns` - **only when the name alone is ambiguous** (units,
  meaning of a flag, what `null`/`undefined` signifies, what an empty result
  means). Skip the tag if it would just echo the identifier.
- `@throws` - whenever the member can throw a meaningful error; name the
  condition.
- `@typeParam` - when a generic parameter's role isn't obvious from its name.
- `@defaultValue` - for optional parameters / properties with a non-obvious default.
- `@remarks` - for longer discussion that shouldn't crowd the summary line.
- `@example` - for any non-trivial public entry point (a language constructor,
  a builder, a top-level export). Wrap code in a fenced ` ```ts ` block. Not
  needed for simple accessors or internal helpers.
- `@see` - to point at the related operator/AST node/visitor.

## Style

- Summary is one sentence, imperative-ish mood ("Builds…", "Returns…"),
  ending with a period.
- Start the comment with the description; no `@summary`.
- Reference other API symbols with `{@link Foo}` so the reference page links them.
- Match the surrounding file: don't reflow or restyle existing comments while
  filling gaps. Fill **only** what the worklist flags; leave documented members
  alone.

## Visitor methods - skip the routine ones

The visitor classes/interfaces (`plan/visitor.ts`, the `visitors/*.ts`,
`ast/visitor.ts`) make up a large share of the worklist, but most entries are
mechanical dispatch methods of the shape:

```ts
visitProjection(operator: Projection, arg?: Arg): Ret;
```

**Do not document these.** A class-level comment on the visitor explaining what
the whole traversal computes is enough; per-node `visitX(node, arg?)` methods
that just handle their node type add only noise.

**Do** document a `visitX` method when it is _unusual_, i.e. it:

- takes **extra or atypical parameters** beyond the node (+ optional `arg`/`ctx`);
- has **side effects or state** a caller must know about (mutates the node,
  accumulates into the visitor, throws on certain node shapes);
- returns something **non-obvious** for that node type, or deviates from the
  pattern the sibling methods follow.

When in doubt for a visitor method, a one-line summary of the unusual part is
plenty - don't pad it with `@param node`.

The whole framework is intended to be extensible, so every protected member
should be documented.
