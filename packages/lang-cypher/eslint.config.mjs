import baseConfig from '../../eslint.config.mjs';

export default [
  {
    ignores: [
      '**/dist',
      'src/parser/cypher.cjs',
      'src/parser/cypher.peggy.mjs',
      'src/parser/cypher.peggy.d.ts',
    ],
  },
  ...baseConfig,
];
