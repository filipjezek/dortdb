import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

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
          editUrl: ({ docPath }) =>
            `https://github.com/filipjezek/dortdb/edit/main/packages/docs/docs/${docPath}`,
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
        src: 'img/logo.svg',
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
          title: 'Docs',
          items: [
            {
              label: 'Getting Started',
              to: '/docs/intro',
            },
            {
              label: 'Cross-language Queries',
              to: '/docs/cross-language-queries',
            },
          ],
        },
        {
          title: 'Packages',
          items: [
            {
              label: '@dortdb/core',
              to: '/docs/core/overview',
            },
            {
              label: '@dortdb/lang-sql',
              to: '/docs/lang-sql/overview',
            },
            {
              label: '@dortdb/lang-xquery',
              to: '/docs/lang-xquery/overview',
            },
            {
              label: '@dortdb/lang-cypher',
              to: '/docs/lang-cypher/overview',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'API Reference',
              to: '/docs/api',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/filipjezek/dortdb',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} DortDB. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
