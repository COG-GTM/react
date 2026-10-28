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

  async function decodeActionId(id) {
    const body = new FormData();
    body.append('$ACTION_ID_' + id, '');
    body.append('name', 'world');
    return ReactServerDOMServer.decodeAction(body);
  }

  it('passes file: URL server reference ids on to the module loader', async () => {
    // The module doesn't exist (and Jest can't run import() without
    // --experimental-vm-modules), so loading still fails, but not because the
    // id was rejected.
    const error = await decodeActionId(ACTIONS_MODULE + '#greet').then(
      () => null,
      e => e,
    );
    expect(error === null ? '' : String(error.message)).not.toContain(
      MANIFEST_ERROR,
    );
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
    for (let i = 0; i < ids.length; i++) {
      await expect(decodeActionId(ids[i])).rejects.toThrow(MANIFEST_ERROR);
    }
  });

  it('rejects server references in decodeReply before importing', async () => {
    const ids = [
      'node:child_process#execSync',
      'data:text/javascript,globalThis.__pwned=1#x',
    ];
    for (let i = 0; i < ids.length; i++) {
      const body = new FormData();
      body.append('0', '"$F1"');
      body.append('1', JSON.stringify({id: ids[i], bound: null}));
      await expect(ReactServerDOMServer.decodeReply(body)).rejects.toThrow(
        MANIFEST_ERROR,
      );
    }
    expect(globalThis.__pwned).toBe(undefined);
  });
});
