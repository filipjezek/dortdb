import baseConfig from '../../eslint.config.mjs';

export default [
  {
    ignores: ['**/dist', 'src/parser/xquery.cjs'],
  },
  ...baseConfig,
];
