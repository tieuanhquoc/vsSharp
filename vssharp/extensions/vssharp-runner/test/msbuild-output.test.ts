import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  buildTargetPathArgs,
  parseMsbuildPropertyOutput,
  parseTargetFrameworkFromProjectXml,
} from '../src/msbuild-output';

test('parseTargetFrameworkFromProjectXml returns single target framework', () => {
  const xml = '<Project><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>';

  assert.equal(parseTargetFrameworkFromProjectXml(xml), 'net8.0');
});

test('parseTargetFrameworkFromProjectXml returns first target framework from multi-target project', () => {
  const xml = '<Project><PropertyGroup><TargetFrameworks>net8.0;net9.0</TargetFrameworks></PropertyGroup></Project>';

  assert.equal(parseTargetFrameworkFromProjectXml(xml), 'net8.0');
});

test('buildTargetPathArgs queries TargetPath with configuration and target framework', () => {
  const args = buildTargetPathArgs('App.csproj', 'Debug', 'net8.0');

  assert.deepEqual(args, [
    'msbuild',
    'App.csproj',
    '-nologo',
    '-getProperty:TargetPath',
    '-p:Configuration=Debug',
    '-p:TargetFramework=net8.0',
  ]);
});

test('parseMsbuildPropertyOutput returns last non-empty line', () => {
  assert.equal(parseMsbuildPropertyOutput('\n  ignored heading\n  C:/app/bin/Debug/net8.0/App.dll\n'), 'C:/app/bin/Debug/net8.0/App.dll');
});
