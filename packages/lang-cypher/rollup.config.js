import commonjs from '@rollup/plugin-commonjs';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';
import replace from '@rollup/plugin-replace';

export default [
  {
    input: 'src/index.ts',
    output: {
      dir: 'dist',
      format: 'es',
      sourcemap: true,
    },
    watch: {
      chokidar: {
        usePolling: true,
      },
    },
    // logLevel: 'silent',
    plugins: [
      replace({
        include: 'src/parser/cypher.cjs',
        preventAssignment: true,
        delimiters: ['', '\\b(?!\\.)'],
        values: {
          __id_start__: '\\p{ID_Start}\\p{Pc}',
          __id_continue__: '\\p{ID_Continue}\\p{Sc}',
          '/i': '/ui',
        },
      }),
      commonjs(),
      esbuild({
        tsconfig: 'tsconfig.json',
      }),
    ],
  },
  {
    input: 'src/index.ts',
    output: [{ file: 'dist/index.d.ts', format: 'es' }],
    plugins: [dts()],
  },
];
