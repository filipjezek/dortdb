export default {
  allowedStartRules: ['Root'],
  format: 'es',
  output: import.meta.dirname + '/sql.peggy.mjs',
  dts: true,
  input: import.meta.dirname + '/sql.pegjs',
  returnTypes: {
    Root: '{value: import("@dortdb/core").ASTNode[], remainingInput: string}',
  },
  sourceMap: true,
  cache: true,
};
