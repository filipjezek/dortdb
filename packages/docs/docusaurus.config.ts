import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import typedocSidebar from './docs/api/typedoc-sidebar';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

function injectTypeDocSidebar(items: any[]) {
  return items.map((item) => {
    if (item.link?.id === 'api/index') {
      return {
        ...item,
        items: typedocSidebar.items,
      };
    }
    return item;
  });
}

const config: Config = {
  title: 'DortDB',
  tagline: 'A modular multi-language in-memory query engine',
  favicon: 'img/favicon.ico',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: 'https://filipjezek.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/dortdb/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'filipjezek',
  projectName: 'dortdb',

  onBrokenLinks: 'throw',

  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css',
      type: 'text/css',
      integrity:
        'sha384-n8MVd4RsNIU0tAv4ct0nTaAbDJwPJzDEaqSD1odI+WdtXRGWt2kTvGFasHpSy3SV',
      crossorigin: 'anonymous',
    },
  ],

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          remarkPlugins: [
            remarkMath,
            [require('@docusaurus/remark-plugin-npm2yarn'), {}],
          ],
          rehypePlugins: [rehypeKatex],
          editUrl: ({ docPath }) =>
            `https://github.com/filipjezek/dortdb/edit/main/packages/docs/docs/${docPath}`,
          async sidebarItemsGenerator({
            defaultSidebarItemsGenerator,
            ...args
          }) {
            return injectTypeDocSidebar(
              await defaultSidebarItemsGenerator(args),
            );
          },
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'DortDB',
      logo: {
        alt: 'DortDB logo',
        src: 'img/logo.png',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        { to: '/docs/api', label: 'API', position: 'left' },
        {
          href: 'https://filipjezek.github.io/dortdb/showcase/',
          label: 'Demo',
          position: 'left',
        },
        {
          href: 'https://github.com/filipjezek/dortdb',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {
              label: 'Introduction',
              to: '/docs/intro',
            },
            {
              label: 'Installation',
              to: '/docs/getting-started/installation',
            },
            {
              label: 'Your First Query',
              to: '/docs/getting-started/first-query',
            },
            {
              label: 'Running Queries',
              to: '/docs/getting-started/running-queries',
            },
          ],
        },
        {
          title: 'Languages',
          items: [
            {
              label: 'SQL',
              to: '/docs/lang-sql/overview',
            },
            {
              label: 'Cypher',
              to: '/docs/lang-cypher/overview',
            },
            {
              label: 'XQuery',
              to: '/docs/lang-xquery/overview',
            },
            {
              label: 'Cross-language Queries',
              to: '/docs/guides/cross-language-queries',
            },
          ],
        },
        {
          title: 'Guides',
          items: [
            {
              label: 'Data Sources & Adapters',
              to: '/docs/guides/data-sources-and-adapters',
            },
            {
              label: 'Indexing & Performance',
              to: '/docs/guides/indexing-and-performance',
            },
            {
              label: 'Extending DortDB',
              to: '/docs/guides/extending/overview',
            },
          ],
        },
        {
          title: 'Concepts',
          items: [
            {
              label: 'Architecture',
              to: '/docs/core/architecture',
            },
            {
              label: 'Design Principles',
              to: '/docs/core/design-principles',
            },
            {
              label: 'Formalism',
              to: '/docs/formalism/overview',
            },
            {
              label: 'API Reference',
              to: '/docs/api',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Live Demo',
              href: 'https://filipjezek.github.io/dortdb/showcase/',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/filipjezek/dortdb',
            },
            {
              label: 'Thesis',
              href: 'http://hdl.handle.net/20.500.11956/209701',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} DortDB. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['sql', 'xquery', 'cypher'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
