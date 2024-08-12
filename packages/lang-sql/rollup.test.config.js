import commonjs from '@rollup/plugin-commonjs';
import glob from 'glob';
import esbuild from 'rollup-plugin-esbuild';

export default {
  input: [...glob.sync('tests/**/*.spec.ts')],
  output: {
    dir: 'dist/tests',
    format: 'es',
    sourcemap: true,
  },
  logLevel: 'silent',
  plugins: [
    commonjs(),
    esbuild({
      tsconfig: 'tsconfig.json',
    }),
  ],
};
