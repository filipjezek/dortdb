import React, { type ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import styles from './styles.module.css';

interface FeatureItem {
  /** Leading emoji shown above the title. */
  icon: string;
  title: string;
  /** Internal doc route the card links to. */
  to: string;
  description: ReactNode;
}

const FeatureList: FeatureItem[] = [
  {
    icon: '🧩',
    title: 'Modular architecture',
    to: '/docs/core/architecture',
    description: (
      <>
        The core, each language, and each extension is a separate package, so a
        browser bundle ships only what you actually import.
      </>
    ),
  },
  {
    icon: '🗣️',
    title: 'Pluggable query languages',
    to: '/docs/lang-sql/overview',
    description: (
      <>
        SQL, Cypher, and XQuery come in the box, one for each major data model,
        and query languages are plug-ins you can add yourself.
      </>
    ),
  },
  {
    icon: '🔀',
    title: 'Multi-language queries',
    to: '/docs/guides/cross-language-queries',
    description: (
      <>
        Embed one language inside another with a <code>LANG</code> block. The
        whole query compiles to a single, optimized plan.
      </>
    ),
  },
  {
    icon: '🧰',
    title: 'Extensible & schema-free',
    to: '/docs/guides/extending/overview',
    description: (
      <>
        Add your own optimizer rules, index types, functions, and data
        adapters, all over plain in-memory values that register in constant
        time.
      </>
    ),
  },
];

/** A single feature card: emoji, linked title, and a short blurb. */
function Feature({ icon, title, to, description }: FeatureItem): ReactNode {
  return (
    <div className={clsx('col col--3')}>
      <Link to={to} className={styles.card}>
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
        <h3 className={styles.cardTitle}>{title}</h3>
        <p className={styles.cardBody}>{description}</p>
      </Link>
    </div>
  );
}

/**
 * The feature-card grid on the homepage. Each card summarizes one of DortDB's
 * defining traits and links to the most relevant documentation page.
 */
export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props) => (
            <Feature key={props.title} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
