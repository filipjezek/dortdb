export default {
  allowedStartRules: ['Cypher'],
  format: 'es',
  output: import.meta.dirname + '/cypher.peggy.mjs',
  dts: true,
  input: import.meta.dirname + '/cypher.pegjs',
  returnTypes: {
    Cypher: '{value: import("@dortdb/core").ASTNode, remainingInput: string}',
  },
  sourceMap: true,
  cache: true,
};
