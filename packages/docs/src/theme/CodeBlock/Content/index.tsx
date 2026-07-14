import React, {type ComponentProps, type ReactNode} from 'react';
import clsx from 'clsx';
import {useCodeBlockContext} from '@docusaurus/theme-common/internal';
import {usePrismTheme} from '@docusaurus/theme-common';
import {Highlight, type Token} from 'prism-react-renderer';
import Line from '@theme/CodeBlock/Line';
import type {CodeBlockMetadata} from '@docusaurus/theme-common/internal';
import type {Props} from '@theme/CodeBlock/Content';
import type {CodeSegment} from '@site/src/theme/multicode-block';

import styles from './styles.module.css';

type MulticodeMetadata = CodeBlockMetadata & {segments?: CodeSegment[]};

// DortDB's `LANG` language switch is not part of any per-segment grammar
// (SQL/Cypher/...), so Prism leaves it unstyled. Re-type each standalone `LANG`
// word as a keyword so it picks up the theme's keyword color everywhere.
const LANG_KEYWORD_RE = /\bLANG\b/;

function highlightLangKeyword(line: Token[]): Token[] {
  return line.flatMap((token) => {
    if (token.types.includes('keyword') || !LANG_KEYWORD_RE.test(token.content)) {
      return token;
    }
    // Split around every `LANG` word, keeping the delimiters.
    return token.content
      .split(/(\bLANG\b)/)
      .filter((part) => part !== '')
      .map((part) =>
        part === 'LANG'
          ? {...token, types: ['keyword'], content: part}
          : {...token, content: part},
      );
  });
}

// TODO Docusaurus v4: remove useless forwardRef
const Pre = React.forwardRef<HTMLPreElement, ComponentProps<'pre'>>(
  (props, ref) => {
    return (
      <pre
        ref={ref}
        tabIndex={0}
        {...props}
        className={clsx(props.className, styles.codeBlock, 'thin-scrollbar')}
      />
    );
  },
);

function Code(props: ComponentProps<'code'>): ReactNode {
  const {metadata} = useCodeBlockContext();
  return (
    <code
      {...props}
      className={clsx(
        props.className,
        styles.codeBlockLines,
        metadata.lineNumbersStart !== undefined &&
          styles.codeBlockLinesWithNumbering,
      )}
      style={{
        ...props.style,
        counterReset:
          metadata.lineNumbersStart === undefined
            ? undefined
            : `line-count ${metadata.lineNumbersStart - 1}`,
      }}
    />
  );
}

/**
 * Highlights a list of {@link CodeSegment}s, each in its own language, as one
 * continuous run of lines. Line class names (magic comments, metastring
 * highlight ranges) are resolved against the concatenated code, so a running
 * global line index is kept across segments.
 */
function MulticodeContent({
  classNameProp,
  segments,
}: {
  classNameProp: string | undefined;
  segments: CodeSegment[];
}): ReactNode {
  const {metadata, wordWrap} = useCodeBlockContext();
  const prismTheme = usePrismTheme();
  const {lineNumbersStart, lineClassNames} = metadata;
  let lineIndex = 0;
  return (
    <Pre
      ref={wordWrap.codeBlockRef}
      className={classNameProp}
      style={prismTheme.plain}>
      <Code>
        {segments.map((segment, segmentIndex) => (
          <Highlight
            key={segmentIndex}
            theme={prismTheme}
            code={segment.code}
            language={segment.lang}>
            {({tokens: lines, getLineProps, getTokenProps}) =>
              lines.map((line) => {
                const i = lineIndex;
                lineIndex += 1;
                return (
                  <Line
                    key={i}
                    line={highlightLangKeyword(line)}
                    getLineProps={getLineProps}
                    getTokenProps={getTokenProps}
                    classNames={lineClassNames[i]}
                    showLineNumbers={lineNumbersStart !== undefined}
                  />
                );
              })
            }
          </Highlight>
        ))}
      </Code>
    </Pre>
  );
}

export default function CodeBlockContent({
  className: classNameProp,
}: Props): ReactNode {
  const {metadata, wordWrap} = useCodeBlockContext();
  const prismTheme = usePrismTheme();
  const {code, language, lineNumbersStart, lineClassNames} =
    metadata as MulticodeMetadata;
  const segments = (metadata as MulticodeMetadata).segments;

  if (segments) {
    return (
      <MulticodeContent classNameProp={classNameProp} segments={segments} />
    );
  }

  return (
    <Highlight theme={prismTheme} code={code} language={language}>
      {({className, style, tokens: lines, getLineProps, getTokenProps}) => (
        <Pre
          ref={wordWrap.codeBlockRef}
          className={clsx(classNameProp, className)}
          style={style}>
          <Code>
            {lines.map((line, i) => (
              <Line
                key={i}
                line={highlightLangKeyword(line)}
                getLineProps={getLineProps}
                getTokenProps={getTokenProps}
                classNames={lineClassNames[i]}
                showLineNumbers={lineNumbersStart !== undefined}
              />
            ))}
          </Code>
        </Pre>
      )}
    </Highlight>
  );
}
