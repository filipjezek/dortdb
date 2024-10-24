import esbuild from 'rollup-plugin-esbuild';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

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
      resolve({ browser: true }),
      commonjs(),
      esbuild({
        tsconfig: 'tsconfig.json',
        minify: true,
      }),
    ],
  },
];
