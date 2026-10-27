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

const ACTIONS_URL = 'file:///app/src/actions.js';
const PAYLOAD_URL = 'data:text/javascript,globalThis.__pwned=1';

describe('ReactFlightDOMNodeUnbundled server references', () => {
  beforeEach(() => {
    jest.resetModules();
    delete globalThis.__pwned;

    jest.mock('react', () => require('react/react.react-server'));
    ReactServerDOMServer = require(
      'react-server-dom-webpack/server.node.unbundled',
    );
  });

  afterEach(() => {
    delete globalThis.__pwned;
  });

  function actionForm(id) {
    const formData = new FormData();
    formData.append('$ACTION_ID_' + id, '');
    formData.append('name', 'Alice');
    return formData;
  }

  async function decodeActionError(formData, manifest) {
    let error = null;
    try {
      await ReactServerDOMServer.decodeAction(formData, manifest);
    } catch (x) {
      error = x;
    }
    return error;
  }

  it('rejects a data: URL action id without evaluating it', async () => {
    const error = await decodeActionError(actionForm(PAYLOAD_URL + '#x'));
    expect(error.message).toBe(
      'Attempted to load a Server Reference outside the hosted root.',
    );
    expect(globalThis.__pwned).toBe(undefined);
  });

  it('rejects Node built-ins and bare specifiers', async () => {
    for (const id of [
      'node:child_process#execSync',
      'child_process#execSync',
      './actions.js#greet',
      '/app/src/actions.js#greet',
      'file:#greet',
      ACTIONS_URL,
    ]) {
      const error = await decodeActionError(actionForm(id));
      expect(error.message).toBe(
        'Attempted to load a Server Reference outside the hosted root.',
      );
    }
  });

  it('rejects a data: URL in a $ACTION_REF_ bound action', async () => {
    const formData = new FormData();
    formData.append('$ACTION_REF_1', '');
    formData.append(
      '$ACTION_1:0',
      JSON.stringify({id: PAYLOAD_URL + '#x', bound: null}),
    );
    const error = await decodeActionError(formData);
    expect(error.message).toBe(
      'Attempted to load a Server Reference outside the hosted root.',
    );
    expect(globalThis.__pwned).toBe(undefined);
  });

  it('rejects a data: URL server reference in decodeReply', async () => {
    const body = new FormData();
    body.append('0', '"$F1"');
    body.append('1', JSON.stringify({id: PAYLOAD_URL + '#x', bound: null}));
    let error = null;
    try {
      await ReactServerDOMServer.decodeReply(body);
    } catch (x) {
      error = x;
    }
    expect(error.message).toBe(
      'Attempted to load a Server Reference outside the hosted root.',
    );
    expect(globalThis.__pwned).toBe(undefined);
  });

  it('rejects ids that are not listed in a provided server manifest', async () => {
    const manifest = {
      'greet-action': {specifier: ACTIONS_URL, name: 'greet'},
    };

    for (const id of [
      ACTIONS_URL + '#greet',
      PAYLOAD_URL + '#x',
      '__proto__',
      'constructor',
      'hasOwnProperty',
    ]) {
      const error = await decodeActionError(actionForm(id), manifest);
      expect(error.message).toBe(
        'Could not find the module "' +
          id +
          '" in the React Server Manifest. ' +
          'This is probably a bug in the React Server Components bundler.',
      );
    }
    expect(globalThis.__pwned).toBe(undefined);
  });
});
