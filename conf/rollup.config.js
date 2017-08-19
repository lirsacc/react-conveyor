/* eslint-disable */
const pkg = require(`${process.cwd()}/package.json`);
const peerDeps = Object.keys(pkg.peerDependencies);

const babel = require('rollup-plugin-babel')({
  externalHelpers: false,
  exclude: 'node_modules/**',
  extends: `${__dirname}/babelrc.build.json`
});

module.exports = {
  entry: 'src/index.jsx',
  sourceMap: true,
  plugins: [babel],
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
