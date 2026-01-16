console.log(import.meta.dirname);

export default {
  allowedStartRules: ['Cypher'],
  format: 'es',
  output: import.meta.dirname + '/cypher.peggy.mjs',
  dts: true,
  input: import.meta.dirname + '/cypher.pegjs',
  returnTypes: {
    Cypher: 'import("@dortdb/core").ASTNode',
  },
  sourceMap: true,
};
