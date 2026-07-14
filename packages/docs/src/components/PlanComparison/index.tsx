import React, { type ReactNode } from 'react';
import styles from './styles.module.css';

export interface PlanComparisonProps {
  /** URL of the "before" plan diagram (relative to the site's static dir). */
  before?: string;
  /** URL of the "after" plan diagram. */
  after?: string;
  /** Alt text for the "before" diagram. Defaults to a generic label. */
  beforeAlt?: string;
  /** Alt text for the "after" diagram. Defaults to a generic label. */
  afterAlt?: string;
  /** Optional caption printed on the arrow between the two plans, e.g. the rule name. */
  label?: string;
  /** Optional figure caption rendered below the pair. */
  children?: ReactNode;
}

/** A single plan panel: an image, or a dashed placeholder if none is supplied yet. */
function Panel({
  src,
  alt,
  side,
}: {
  src?: string;
  alt: string;
  side: 'before' | 'after';
}): ReactNode {
  return (
    <figure className={styles.panel}>
      {src ? (
        <img className={styles.image} src={require('@site/static' + src).default} alt={alt} />
      ) : (
        <div className={styles.placeholder} role="img" aria-label={alt}>
          diagram coming soon
        </div>
      )}
      <figcaption className={styles.panelLabel}>{side}</figcaption>
    </figure>
  );
}

/**
 * Renders a before → after comparison of a query plan, used to illustrate what
 * an optimizer rule does. Panels lay out side by side on wide screens and stack
 * vertically on narrow ones; the connecting arrow rotates accordingly.
 *
 * Until diagram images are available, omit `before`/`after` to render dashed
 * placeholders of the same footprint. Registered as the `<PlanComparison>` MDX
 * component.
 */
export default function PlanComparison({
  before,
  after,
  beforeAlt = 'Query plan before the rewrite',
  afterAlt = 'Query plan after the rewrite',
  label,
  children,
}: PlanComparisonProps): ReactNode {
  return (
    <figure className={styles.comparison}>
      <div className={styles.pair}>
        <Panel src={before} alt={beforeAlt} side="before" />
        <div className={styles.arrow} aria-hidden="true">
          <span className={styles.arrowGlyph}>&rarr;</span>
          {label && <span className={styles.arrowLabel}>{label}</span>}
        </div>
        <Panel src={after} alt={afterAlt} side="after" />
      </div>
      {children && (
        <figcaption className={styles.caption}>{children}</figcaption>
      )}
    </figure>
  );
}
