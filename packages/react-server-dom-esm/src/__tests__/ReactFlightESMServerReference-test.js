/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 * @jest-environment node
 */

'use strict';

let ReactServerDOMServer;

// The resolver is internal, so it can only be required in source tests.
function getResolveServerReference() {
  return require('react-server-dom-esm/src/client/ReactFlightClientConfigBundlerESM')
    .resolveServerReference;
}

const moduleBasePath = 'file:///app/src';
const OUTSIDE_ROOT =
  'Attempted to load a Server Reference outside the hosted root.';

const outsideRootIds = [
  'file:///app/src/../package.json#x',
  'file:///app/src/../node_modules/cross-spawn/index.js#default',
  'file:///app/src/./../../etc/passwd#x',
  'file:///app/src/nested/../../secret.js#x',
  'file:///app/src/..#x',
  'file:///app/src/%2e%2e/package.json#x',
  'file:///app/src/.%2E/package.json#x',
  'file:///app/src/%2e./package.json#x',
  'file:///app/src/..%2fpackage.json#x',
  'file:///app/src/..%5Cpackage.json#x',
  'file:///app/src/..\\package.json#x',
  'file:///app/src/.\t./package.json#x',
  'file:///app/src/.\n./package.json#x',
  'file:///app/src-secret/actions.js#x',
  'file:///app/srcfoo.js#x',
  'file:///app/src#x',
  'file:///app/src/#x',
  'file:///etc/passwd#x',
  'file:///app/src/actions.js',
];

describe('ReactFlightESMServerReference', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('react', () => require('react/react.react-server'));
    jest.mock('react-server-dom-esm/server', () =>
      require('react-server-dom-esm/server.node'),
    );
    ReactServerDOMServer = require('react-server-dom-esm/server');
  });

  // @gate source
  it('resolves server references inside the hosted root', () => {
    const resolveServerReference = getResolveServerReference();
    expect(
      resolveServerReference(moduleBasePath, moduleBasePath + '/actions.js#a'),
    ).toEqual({specifier: moduleBasePath + '/actions.js', name: 'a'});
    expect(
      resolveServerReference(
        moduleBasePath + '/',
        moduleBasePath + '/nested/dir/actions.js#default',
      ),
    ).toEqual({
      specifier: moduleBasePath + '/nested/dir/actions.js',
      name: 'default',
    });
    expect(
      resolveServerReference(
        'file:///My%20App/src',
        'file:///My%20App/src/a..b/actions.js#a',
      ),
    ).toEqual({specifier: 'file:///My%20App/src/a..b/actions.js', name: 'a'});
  });

  // @gate source
  it('rejects server references outside the hosted root', () => {
    const resolveServerReference = getResolveServerReference();
    for (let i = 0; i < outsideRootIds.length; i++) {
      expect(() =>
        resolveServerReference(moduleBasePath, outsideRootIds[i]),
      ).toThrow(OUTSIDE_ROOT);
    }
  });

  // @gate source
  it('rejects path traversal in plain path roots', () => {
    const resolveServerReference = getResolveServerReference();
    expect(() =>
      resolveServerReference(
        '/app/src/',
        '/app/src/../node_modules/cross-spawn/index.js#default',
      ),
    ).toThrow(OUTSIDE_ROOT);
    expect(() =>
      resolveServerReference('/app/src', '/app/src-secret/actions.js#x'),
    ).toThrow(OUTSIDE_ROOT);
    expect(resolveServerReference('/app/src', '/app/src/actions.js#x')).toEqual(
      {specifier: '/app/src/actions.js', name: 'x'},
    );
  });

  it('rejects a $F reply reference that escapes the root before importing it', async () => {
    const body = new FormData();
    body.append('0', '"$F1"');
    body.append(
      '1',
      JSON.stringify({id: moduleBasePath + '/../package.json#x', bound: []}),
    );
    await expect(async () =>
      ReactServerDOMServer.decodeReply(body, moduleBasePath),
    ).rejects.toThrow(OUTSIDE_ROOT);
  });

  it('rejects an $ACTION_ID_ that escapes the root before importing it', async () => {
    const body = new FormData();
    body.append(
      '$ACTION_ID_' + moduleBasePath + '/../node_modules/x/bin/cli.js#x',
      '',
    );
    await expect(async () =>
      ReactServerDOMServer.decodeAction(body, moduleBasePath),
    ).rejects.toThrow(OUTSIDE_ROOT);
  });
});
