import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  to: string;
};

const FeatureList: FeatureItem[] = [
  {
    eyebrow: 'Multi-language',
    title: 'Move across relational, document, and graph-shaped data.',
    description: (
      <>
        Configure a single DortDB instance with SQL, XQuery, and Cypher, then
        switch languages inside a query when that makes the plan simpler.
      </>
    ),
    to: '/docs/cross-language-queries',
  },
  {
    eyebrow: 'Composable core',
    title: 'Share one optimizer, one execution model, many frontends.',
    description: (
      <>
        The core package owns parsing flow, planning, execution, extensions,
        indices, and optimizer hooks. Language packages plug into that surface.
      </>
    ),
    to: '/docs/core/overview',
  },
  {
    eyebrow: 'From source',
    title: 'Generated API reference stays aligned with the code you export.',
    description: (
      <>
        Public TypeScript exports are rendered automatically under the API
        section, so signatures and type shapes do not drift from the packages.
      </>
    ),
      to: '/docs/api',
  },
];

function Feature({eyebrow, title, description, to}: FeatureItem) {
  return (
    <div className={clsx('col col--4', styles.featureColumn)}>
      <article className={styles.featureCard}>
        <p className={styles.featureEyebrow}>{eyebrow}</p>
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
        <Link className={styles.featureLink} to={to}>
          Learn more
        </Link>
      </article>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
