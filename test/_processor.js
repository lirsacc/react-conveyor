/* eslint-disable */
const fs = require('fs');
const babelConfig = JSON.parse(
  fs.readFileSync(`${__dirname}/../conf/babelrc.test.json`).toString()
);
module.exports = require('babel-jest').createTransformer(babelConfig);
