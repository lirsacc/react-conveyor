/* eslint-disable */
const pkg = require(`${process.cwd()}/package.json`);
const peerDeps = Object.keys(pkg.peerDependencies || {});

const filesize = require('rollup-plugin-filesize')();

const babel = require('rollup-plugin-babel')({
  externalHelpers: false,
  exclude: '**/node_modules/**',
  extends: `${__dirname}/../.babelrc`
});

module.exports = {
  input: 'src/index.jsx',
  plugins: [babel, filesize],
  external: peerDeps,
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/es.js',
      format: 'es',
      sourcemap: true,
    }
  ]
};
