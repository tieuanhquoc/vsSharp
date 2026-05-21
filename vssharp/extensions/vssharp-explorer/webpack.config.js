'use strict';
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
  target: 'node',
  mode: 'none',
  entry: './src/main.ts',
  output: {
    path: path.resolve(__dirname, 'extension'),
    filename: 'main.js',
    libraryTarget: 'commonjs2',
  },
  externals: { vscode: 'commonjs vscode' },
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [
      { test: /\.ts$/, exclude: /node_modules/, use: [{ loader: 'ts-loader' }] },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'media', to: 'media' },
      ],
    }),
  ],
  devtool: false,
  infrastructureLogging: { level: 'log' },
};
