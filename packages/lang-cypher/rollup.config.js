import commonjs from '@rollup/plugin-commonjs';
import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';

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
