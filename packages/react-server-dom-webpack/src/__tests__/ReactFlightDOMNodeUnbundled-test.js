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

const ACTIONS_MODULE = 'file:///app/actions.js';
const MANIFEST_ERROR = 'in the React Server Manifest.';

describe('ReactFlightDOMNodeUnbundled', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('react', () => require('react/react.react-server'));
    ReactServerDOMServer = require('react-server-dom-webpack/server.node.unbundled');

    jest.mock(
      'file:///app/actions.js',
      () => {
        const {
          registerServerReference,
        } = require('react-server-dom-webpack/server.node.unbundled');
        function greet(formData) {
          return 'hi ' + formData.get('name');
        }
        registerServerReference(greet, 'file:///app/actions.js', 'greet');
        function notAnAction() {
          return 'not exposed';
        }
        return {greet, notAnAction};
      },
      {virtual: true},
    );
    jest.mock(
      'data:text/javascript,globalThis.__pwned=1',
      () => {
        globalThis.__pwned = 1;
        return {x() {}};
      },
      {virtual: true},
    );
  });

  afterEach(() => {
    delete globalThis.__pwned;
  });

  function decodeActionId(id) {
    const body = new FormData();
    body.append('$ACTION_ID_' + id, '');
    body.append('name', 'world');
    return ReactServerDOMServer.decodeAction(body);
  }

  it('resolves a registered server action', async () => {
    const action = await decodeActionId(ACTIONS_MODULE + '#greet');
    expect(await action()).toBe('hi world');
  });

  it('rejects data: URL specifiers without importing them', async () => {
    await expect(
      decodeActionId('data:text/javascript,globalThis.__pwned=1#x'),
    ).rejects.toThrow(
      'Could not find the module ' +
        '"data:text/javascript,globalThis.__pwned=1#x" ' +
        MANIFEST_ERROR,
    );
    expect(globalThis.__pwned).toBe(undefined);
  });

  it('rejects built-in, bare, relative and remote specifiers', async () => {
    const ids = [
      'child_process#execSync',
      'node:child_process#execSync',
      './actions.js#greet',
      'file://host/actions.js#greet',
      'file:///app/actions.js',
    ];
    for (const id of ids) {
      await expect(decodeActionId(id)).rejects.toThrow(MANIFEST_ERROR);
    }
  });

  it('rejects exports that are not registered server references', async () => {
    await expect(
      decodeActionId(ACTIONS_MODULE + '#notAnAction'),
    ).rejects.toThrow(MANIFEST_ERROR);
    await expect(
      decodeActionId(ACTIONS_MODULE + '#constructor'),
    ).rejects.toThrow(MANIFEST_ERROR);
  });

  it('only resolves registered server references in decodeReply', async () => {
    const body = new FormData();
    body.append('0', '"$F1"');
    body.append(
      '1',
      JSON.stringify({id: 'node:child_process#execSync', bound: null}),
    );
    await expect(ReactServerDOMServer.decodeReply(body)).rejects.toThrow(
      MANIFEST_ERROR,
    );

    const okBody = new FormData();
    okBody.append('0', '"$F1"');
    okBody.append(
      '1',
      JSON.stringify({id: ACTIONS_MODULE + '#greet', bound: null}),
    );
    const fn = await ReactServerDOMServer.decodeReply(okBody);
    expect(fn.$$id).toBe(ACTIONS_MODULE + '#greet');
  });
});
