import esbuild from 'rollup-plugin-esbuild';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default [
  {
    input: 'src/showcase/index.ts',
    output: {
      dir: 'dist/showcase',
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
        minify: false,
      }),
      copy({
        targets: [
          { src: 'src/showcase/index.html', dest: 'dist/showcase' },
          { src: 'src/showcase/styles.css', dest: 'dist/showcase' },
        ],
      }),
    ],
  },
  {
    input: 'src/unibench/index.ts',
    output: {
      dir: 'dist/unibench',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      esbuild({
        tsconfig: 'tsconfig.json',
        target: 'es2023',
        minify: false,
      }),
    ],
  },
];
