import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={styles.heroBanner}>
      <div className={clsx('container', styles.heroGrid)}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>DortDB Documentation</p>
          <Heading as="h1" className={styles.heroTitle}>
            Query objects, XML, and graphs with one engine.
          </Heading>
          <p className={styles.heroSubtitle}>{siteConfig.tagline}</p>
          <p className={styles.heroBody}>
            DortDB combines a shared execution core with SQL, XQuery, and
            Cypher frontends, so you can move across data models without
            switching runtimes.
          </p>
          <div className={styles.buttons}>
            <Link className="button button--primary button--lg" to="/docs/intro">
              Start With The Guides
            </Link>
                  <Link className="button button--secondary button--lg" to="/docs/api">
              Browse Generated API
            </Link>
          </div>
          <div className={styles.languageStrip}>
            <span>SQL</span>
            <span>Cypher</span>
            <span>XQuery</span>
            <span>LANG switch</span>
            <span>TypeScript API</span>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelLabel}>Quick Setup</span>
            <span className={styles.panelNote}>core + 3 language packages</span>
          </div>
          <pre className={styles.codePanel}>
            <code>{`import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { Cypher } from '@dortdb/lang-cypher';
import { XQuery } from '@dortdb/lang-xquery';

const db = new DortDB({
  mainLang: SQL(),
  additionalLangs: [
    Cypher({ defaultGraph: 'defaultGraph' }),
    XQuery(),
  ],
});`}</code>
          </pre>
          <div className={styles.panelStats}>
            <div>
              <strong>1 core</strong>
              <span>Shared optimizer and execution model</span>
            </div>
            <div>
              <strong>3 query languages</strong>
              <span>Composable in a single query via LANG blocks</span>
            </div>
            <div>
              <strong>Generated API</strong>
              <span>Public exports documented directly from source</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`${siteConfig.title} documentation`}
      description="Documentation for DortDB core and language packages, including TypeScript API reference.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
      </main>
    </Layout>
  );
}
