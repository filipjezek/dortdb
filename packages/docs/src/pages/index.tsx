import React, { type ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import MulticodeBlock from '@site/src/theme/multicode-block';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import styles from './index.module.css';

const DEMO_URL = 'https://filipjezek.github.io/dortdb/showcase/';
const GITHUB_URL = 'https://github.com/filipjezek/dortdb';

// The flagship mixed-language query, split at its LANG boundaries so each slice
// is highlighted in its own language by MulticodeBlock.
const mixedLangSegments = [
  { lang: 'sql', code: 'SELECT name, age\nFROM users\nWHERE age > 30 AND (\n  LANG xquery' },
  { lang: 'xquery', code: '  fn:count($invoices/customer[. = $users:name])' },
  { lang: 'sql', code: ') > 5' },
];

/** The hero banner: logo, title, tagline, and the primary calls to action. */
function HomepageHeader(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <img
          className={styles.logo}
          src={useBaseUrl('img/logo.png')}
          alt="DortDB logo"
          width={96}
          height={96}
        />
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <p className={styles.heroLede}>
          Query the arrays, DOM trees, and graphs already in your app's memory,
          in place and across languages, with no database process and no import
          step.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/intro"
          >
            Get Started
          </Link>
          <Link
            className="button button--secondary button--lg"
            to={DEMO_URL}
          >
            Live Demo
          </Link>
          <Link
            className="button button--secondary button--lg"
            to={GITHUB_URL}
          >
            GitHub
          </Link>
        </div>
      </div>
    </header>
  );
}

/** A highlighted example of the flagship cross-language query feature. */
function HomepageExample(): ReactNode {
  return (
    <section className={styles.example}>
      <div className="container">
        <h2 className={styles.exampleTitle}>One query, many languages</h2>
        <p className={styles.exampleLede}>
          Every language lowers to the same algebra, so a <code>LANG</code>{' '}
          block is not an opaque call to another engine. It becomes part of one
          plan the optimizer reasons about as a whole, letting you express each
          part of a cross-model query in the language that fits it best. Here
          SQL filters users by a count computed with XQuery over an XML
          document.
        </p>
        <MulticodeBlock segments={mixedLangSegments} />
        <p className={styles.exampleFooter}>
          Read more in{' '}
          <Link to="/docs/guides/cross-language-queries">
            Cross-language Queries
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title={siteConfig.title}
      description="A modular, multi-language query engine for in-memory JavaScript data."
    >
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <HomepageExample />
      </main>
    </Layout>
  );
}
