export default {
  allowedStartRules: ['Root'],
  format: 'es',
  output: import.meta.dirname + '/xquery.peggy.mjs',
  dts: true,
  input: import.meta.dirname + '/xquery.pegjs',
  returnTypes: {
    Root: '{value: import("@dortdb/core").ASTNode, remainingInput: string}',
  },
  sourceMap: true,
  cache: true,
};
