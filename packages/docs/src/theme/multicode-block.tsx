import React, {
  Children,
  isValidElement,
  type ReactNode,
} from 'react';
import {useThemeConfig} from '@docusaurus/theme-common';
import {
  CodeBlockContextProvider,
  createCodeBlockMetadata,
  useCodeWordWrap,
} from '@docusaurus/theme-common/internal';
import CodeBlockLayout from '@theme/CodeBlock/Layout';

/**
 * A per-language slice of a multi-language code block. The swizzled
 * `CodeBlock/Content` highlights each slice in its own language.
 */
export interface CodeSegment {
  /** Prism language name used to highlight this slice (e.g. `sql`, `xquery`). */
  lang: string;
  /** Source code for this slice. */
  code: string;
}

export interface MulticodeProps {
  /**
   * Explicit list of segments. Takes precedence over {@link MulticodeProps.children}.
   * `lang` defaults to `text` when omitted.
   */
  segments?: {lang?: string; code: string}[];
  /**
   * Nested fenced code blocks, one per language slice. This is the preferred,
   * more readable way to author a multi-language block in MDX:
   *
   * ```mdx
   * <MulticodeBlock>
   * ```sql
   * SELECT productId FROM (
   * ```
   * ```xquery
   *   let $x := ...
   * ```
   * ```sql
   * ) x
   * ```
   * </MulticodeBlock>
   * ```
   */
  children?: ReactNode;
  className?: string;
}

const LANGUAGE_CLASS_RE = /language-([\w-]+)/;

/**
 * Recursively pull the language + source string out of an MDX-rendered fenced
 * code block. MDX turns ```` ```lang ```` into a `<pre>`/CodeBlock wrapping a
 * `<code className="language-lang">` element whose children are the raw source.
 */
function extractSegment(node: ReactNode): CodeSegment | null {
  if (!isValidElement(node)) {
    return null;
  }
  const props = node.props as {
    className?: string;
    children?: ReactNode;
  };

  const match = props.className?.match(LANGUAGE_CLASS_RE);
  if (match && typeof props.children === 'string') {
    return {lang: match[1], code: props.children};
  }

  // Descend into wrappers (MDXPre -> code, fragments, etc.).
  for (const child of Children.toArray(props.children)) {
    const segment = extractSegment(child);
    if (segment) {
      return segment;
    }
  }
  return null;
}

function segmentsFromChildren(children: ReactNode): CodeSegment[] {
  return Children.toArray(children)
    .map(extractSegment)
    .filter((s): s is CodeSegment => s !== null);
}

/** Drop a single trailing newline so adjacent segments stay contiguous. */
function trimTrailingNewline(code: string): string {
  return code.endsWith('\n') ? code.slice(0, -1) : code;
}

/**
 * Combine several code blocks written in different languages into one visually
 * continuous, per-segment syntax-highlighted code block.
 *
 * Rendering (container chrome, copy button, word-wrap toggle, line numbers) is
 * delegated to the theme's {@link CodeBlockLayout}; the `segments` field on the
 * code block metadata makes the swizzled `CodeBlock/Content` highlight each
 * slice in its own language. Registered as the `<MulticodeBlock>` MDX component.
 */
export default function MulticodeBlock({
  segments,
  children,
  className,
}: MulticodeProps): ReactNode {
  const {prism} = useThemeConfig();
  const wordWrap = useCodeWordWrap();
  const resolved = (segments ?? segmentsFromChildren(children)).map((s) => ({
    lang: s.lang ?? 'text',
    code: trimTrailingNewline(s.code),
  }));

  if (resolved.length === 0) {
    return null;
  }

  const metadata = {
    ...createCodeBlockMetadata({
      code: resolved.map((s) => s.code).join('\n'),
      className: undefined,
      language: 'text',
      defaultLanguage: prism.defaultLanguage,
      metastring: undefined,
      magicComments: prism.magicComments,
      title: undefined,
      showLineNumbers: undefined,
    }),
    segments: resolved,
  };

  return (
    <CodeBlockContextProvider metadata={metadata} wordWrap={wordWrap}>
      <CodeBlockLayout className={className} />
    </CodeBlockContextProvider>
  );
}
