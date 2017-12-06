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
  entry: 'src/index.jsx',
  sourceMap: true,
  plugins: [babel, filesize],
  external: peerDeps,
  targets: [
    {
      dest: 'dist/index.js',
      format: 'cjs',
    },
    {
      dest: 'dist/es.js',
      format: 'es',
    }
  ]
};
