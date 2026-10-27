/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails react-core
 * @jest-environment ./scripts/jest/ReactDOMServerIntegrationEnvironment
 */

'use strict';

// Polyfills for test environment
global.ReadableStream =
  require('web-streams-polyfill/ponyfill/es6').ReadableStream;
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

global.Blob = require('buffer').Blob;
if (typeof File === 'undefined' || typeof FormData === 'undefined') {
  global.File = require('buffer').File || require('undici').File;
  global.FormData = require('undici').FormData;
}

let serverExports;
let webpackServerMap;
let ReactServerDOMServer;
let ReactServerDOMClient;

describe('ReactFlightDOMReplyEdge', () => {
  beforeEach(() => {
    jest.resetModules();
    // Simulate the condition resolution
    jest.mock('react', () => require('react/react.react-server'));
    jest.mock('react-server-dom-webpack/server', () =>
      require('react-server-dom-webpack/server.edge'),
    );
    const WebpackMock = require('./utils/WebpackMock');
    serverExports = WebpackMock.serverExports;
    webpackServerMap = WebpackMock.webpackServerMap;
    ReactServerDOMServer = require('react-server-dom-webpack/server.edge');
    jest.resetModules();
    ReactServerDOMClient = require('react-server-dom-webpack/client.edge');
  });

  it('can encode a reply', async () => {
    const body = await ReactServerDOMClient.encodeReply({some: 'object'});
    const decoded = await ReactServerDOMServer.decodeReply(
      body,
      webpackServerMap,
    );

    expect(decoded).toEqual({some: 'object'});
  });

  it('should be able to serialize any kind of typed array', async () => {
    const buffer = new Uint8Array([
      123, 4, 10, 5, 100, 255, 244, 45, 56, 67, 43, 124, 67, 89, 100, 20,
    ]).buffer;
    const buffers = [
      buffer,
      new Int8Array(buffer, 1),
      new Uint8Array(buffer, 2),
      new Uint8ClampedArray(buffer, 2),
      new Int16Array(buffer, 2),
      new Uint16Array(buffer, 2),
      new Int32Array(buffer, 4),
      new Uint32Array(buffer, 4),
      new Float32Array(buffer, 4),
      new Float64Array(buffer, 0),
      new BigInt64Array(buffer, 0),
      new BigUint64Array(buffer, 0),
      new DataView(buffer, 3),
    ];

    const body = await ReactServerDOMClient.encodeReply(buffers);
    const result = await ReactServerDOMServer.decodeReply(
      body,
      webpackServerMap,
    );

    expect(result).toEqual(buffers);
    // Array buffers can't use the toEqual helper.
    expect(new Uint8Array(result[0])).toEqual(new Uint8Array(buffers[0]));
  });

  it('should be able to serialize a typed array inside a Map', async () => {
    const array = new Uint8Array([
      123, 4, 10, 5, 100, 255, 244, 45, 56, 67, 43, 124, 67, 89, 100, 20,
    ]);
    const map = new Map();
    map.set('array', array);

    const body = await ReactServerDOMClient.encodeReply(map);
    const result = await ReactServerDOMServer.decodeReply(
      body,
      webpackServerMap,
    );

    expect(result.get('array')).toEqual(array);
  });

  it('should be able to serialize a blob', async () => {
    const bytes = new Uint8Array([
      123, 4, 10, 5, 100, 255, 244, 45, 56, 67, 43, 124, 67, 89, 100, 20,
    ]);
    const blob = new Blob([bytes, bytes], {
      type: 'application/x-test',
    });
    const body = await ReactServerDOMClient.encodeReply(blob);
    const result = await ReactServerDOMServer.decodeReply(
      body,
      webpackServerMap,
    );
    expect(result instanceof Blob).toBe(true);
    expect(result.size).toBe(bytes.length * 2);
    expect(await result.arrayBuffer()).toEqual(await blob.arrayBuffer());
  });

  it('can transport FormData (blobs)', async () => {
    const bytes = new Uint8Array([
      123, 4, 10, 5, 100, 255, 244, 45, 56, 67, 43, 124, 67, 89, 100, 20,
    ]);
    const blob = new Blob([bytes, bytes], {
      type: 'application/x-test',
    });

    const formData = new FormData();
    formData.append('hi', 'world');
    formData.append('file', blob, 'filename.test');

    expect(formData.get('file') instanceof File).toBe(true);
    expect(formData.get('file').name).toBe('filename.test');

    const body = await ReactServerDOMClient.encodeReply(formData);
    const result = await ReactServerDOMServer.decodeReply(
      body,
      webpackServerMap,
    );

    expect(result instanceof FormData).toBe(true);
    expect(result.get('hi')).toBe('world');
    const resultBlob = result.get('file');
    expect(resultBlob instanceof Blob).toBe(true);
    expect(resultBlob.name).toBe('filename.test'); // In this direction we allow file name to pass through but not other direction.
    expect(resultBlob.size).toBe(bytes.length * 2);
    expect(await resultBlob.arrayBuffer()).toEqual(await blob.arrayBuffer());
  });

  it('should supports ReadableStreams with typed arrays', async () => {
    const buffer = new Uint8Array([
      123, 4, 10, 5, 100, 255, 244, 45, 56, 67, 43, 124, 67, 89, 100, 20,
    ]).buffer;
    const buffers = [
      buffer,
      new Int8Array(buffer, 1),
      new Uint8Array(buffer, 2),
      new Uint8ClampedArray(buffer, 2),
      new Int16Array(buffer, 2),
      new Uint16Array(buffer, 2),
      new Int32Array(buffer, 4),
      new Uint32Array(buffer, 4),
      new Float32Array(buffer, 4),
      new Float64Array(buffer, 0),
      new BigInt64Array(buffer, 0),
      new BigUint64Array(buffer, 0),
      new DataView(buffer, 3),
    ];

    // This is not a binary stream, it's a stream that contain binary chunks.
    const s = new ReadableStream({
      start(c) {
        for (let i = 0; i < buffers.length; i++) {
          c.enqueue(buffers[i]);
        }
        c.close();
      },
    });

    const body = await ReactServerDOMClient.encodeReply(s);
    const result = await ReactServerDOMServer.decodeReply(
      body,
      webpackServerMap,
    );

    const streamedBuffers = [];
    const reader = result.getReader();
    let entry;
    while (!(entry = await reader.read()).done) {
      streamedBuffers.push(entry.value);
    }

    expect(streamedBuffers).toEqual(buffers);
  });

  it('should support BYOB binary ReadableStreams', async () => {
    const buffer = new Uint8Array([
      123, 4, 10, 5, 100, 255, 244, 45, 56, 67, 43, 124, 67, 89, 100, 20,
    ]).buffer;
    const buffers = [
      new Int8Array(buffer, 1),
      new Uint8Array(buffer, 2),
      new Uint8ClampedArray(buffer, 2),
      new Int16Array(buffer, 2),
      new Uint16Array(buffer, 2),
      new Int32Array(buffer, 4),
      new Uint32Array(buffer, 4),
      new Float32Array(buffer, 4),
      new Float64Array(buffer, 0),
      new BigInt64Array(buffer, 0),
      new BigUint64Array(buffer, 0),
      new DataView(buffer, 3),
    ];

    // This a binary stream where each chunk ends up as Uint8Array.
    const s = new ReadableStream({
      type: 'bytes',
      start(c) {
        for (let i = 0; i < buffers.length; i++) {
          c.enqueue(buffers[i]);
        }
        c.close();
      },
    });

    const body = await ReactServerDOMClient.encodeReply(s);
    const result = await ReactServerDOMServer.decodeReply(
      body,
      webpackServerMap,
    );

    const streamedBuffers = [];
    const reader = result.getReader({mode: 'byob'});
    let entry;
    while (!(entry = await reader.read(new Uint8Array(10))).done) {
      expect(entry.value instanceof Uint8Array).toBe(true);
      streamedBuffers.push(entry.value);
    }

    // The streamed buffers might be in different chunks and in Uint8Array form but
    // the concatenated bytes should be the same.
    expect(streamedBuffers.flatMap(t => Array.from(t))).toEqual(
      buffers.flatMap(c =>
        Array.from(new Uint8Array(c.buffer, c.byteOffset, c.byteLength)),
      ),
    );
  });

  it('should abort when parsing an incomplete payload', async () => {
    const infinitePromise = new Promise(() => {});
    const controller = new AbortController();
    const promiseForResult = ReactServerDOMClient.encodeReply(
      {promise: infinitePromise},
      {
        signal: controller.signal,
      },
    );
    controller.abort();
    const body = await promiseForResult;

    const decoded = await ReactServerDOMServer.decodeReply(
      body,
      webpackServerMap,
    );

    let error = null;
    try {
      await decoded.promise;
    } catch (x) {
      error = x;
    }
    expect(error).not.toBe(null);
    expect(error.message).toBe('Connection closed.');
  });

  it('can stream the decoding using an async iterable', async () => {
    let resolve;
    const promise = new Promise(r => (resolve = r));

    const buffer = new Uint8Array([
      123, 4, 10, 5, 100, 255, 244, 45, 56, 67, 43, 124, 67, 89, 100, 20,
    ]);

    const formData = await ReactServerDOMClient.encodeReply({
      a: Promise.resolve('hello'),
      b: Promise.resolve(buffer),
    });

    const iterable = {
      async *[Symbol.asyncIterator]() {
        // eslint-disable-next-line no-for-of-loops/no-for-of-loops
        for (const entry of formData) {
          yield entry;
          await promise;
        }
      },
    };

    const decoded = await ReactServerDOMServer.decodeReplyFromAsyncIterable(
      iterable,
      webpackServerMap,
    );

    expect(Object.keys(decoded)).toEqual(['a', 'b']);

    await resolve();

    expect(await decoded.a).toBe('hello');
    expect(Array.from(await decoded.b)).toEqual(Array.from(buffer));
  });

  it('can pass a registered server reference', async () => {
    function greet(name) {
      return 'hi, ' + name;
    }
    const ServerModule = serverExports({
      greet,
    });

    ReactServerDOMClient.registerServerReference(
      ServerModule.greet,
      ServerModule.greet.$$id,
    );

    const body = await ReactServerDOMClient.encodeReply({
      method: ServerModule.greet,
      boundMethod: ServerModule.greet.bind(null, 'there'),
    });
    const replyResult = await ReactServerDOMServer.decodeReply(
      body,
      webpackServerMap,
    );
    expect(replyResult.method).toBe(greet);
    expect(replyResult.boundMethod()).toBe('hi, there');
  });

  it('can decode references to own properties of a previously decoded object', async () => {
    const shared = {nested: {value: 'shared'}};
    const body = await ReactServerDOMClient.encodeReply({
      a: shared,
      b: shared.nested,
      c: [shared],
    });
    const decoded = await ReactServerDOMServer.decodeReply(
      body,
      webpackServerMap,
    );
    expect(decoded.a).toEqual({nested: {value: 'shared'}});
    expect(decoded.b).toEqual({value: 'shared'});
    expect(decoded.c).toEqual([{nested: {value: 'shared'}}]);
  });

  it('does not execute code from a forged chunk in the reply', async () => {
    delete globalThis.__pwned;
    const body = new FormData();
    body.append(
      '0',
      JSON.stringify({
        then: '$1:__proto__:then',
        status: 'resolved_model',
        reason: -1,
        value: '{"then":"$B1337"}',
        _response: {
          _prefix: 'globalThis.__pwned=1;//',
          _formData: {get: '$1:constructor:constructor'},
        },
      }),
    );
    body.append('1', '"$@0"');

    let error;
    try {
      await ReactServerDOMServer.decodeReply(body, webpackServerMap);
    } catch (x) {
      error = x;
    }
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Invalid reference.');
    expect(globalThis.__pwned).toBe(undefined);
  });

  it('rejects references to prototype properties', async () => {
    const references = [
      '$1:__proto__',
      '$1:constructor',
      '$1:constructor:constructor',
      '$1:hasOwnProperty',
      '$1:then',
      '$1:value',
      '$1:_response',
    ];
    const targets = ['{}', '"$@2"'];
    for (let i = 0; i < references.length; i++) {
      const reference = references[i];
      for (let j = 0; j < targets.length; j++) {
        const target = targets[j];
        const body = new FormData();
        body.append('0', JSON.stringify({x: reference}));
        body.append('1', target);
        body.append('2', '"hi"');
        await expect(
          ReactServerDOMServer.decodeReply(body, webpackServerMap),
        ).rejects.toThrow('Invalid reference.');
      }
    }
  });

  it('rejects prototype references that are resolved after a cycle', async () => {
    await expect(
      ReactServerDOMServer.decodeReply(
        '{"a":{},"b":"$0:a:constructor:constructor"}',
        webpackServerMap,
      ),
    ).rejects.toThrow('Invalid reference.');
  });

  it('does not let Chunk.prototype.then initialize a forged chunk', async () => {
    delete globalThis.__pwned;
    const root = ReactServerDOMServer.decodeReply('"hi"', webpackServerMap);
    const chunkThen = Object.getPrototypeOf(root).then;
    const forged = {
      then: chunkThen,
      status: 'resolved_model',
      reason: -1,
      value: '{"x":"$B0"}',
      _response: {
        _prefix: '',
        _formData: {
          get() {
            globalThis.__pwned = 1;
          },
        },
      },
    };
    await expect(Promise.resolve(forged)).rejects.toThrow(
      'Invalid reference.',
    );
    expect(globalThis.__pwned).toBe(undefined);
    expect(await root).toBe('hi');
  });

  it('rejects server reference metadata whose bound arguments are not a promise', async () => {
    function greet(name) {
      return 'hi, ' + name;
    }
    const ServerModule = serverExports({greet});
    const body = new FormData();
    body.append('0', '"$F1"');
    body.append(
      '1',
      JSON.stringify({
        id: ServerModule.greet.$$id,
        bound: {then: '$F2'},
      }),
    );
    body.append(
      '2',
      JSON.stringify({id: ServerModule.greet.$$id, bound: null}),
    );
    await expect(
      ReactServerDOMServer.decodeReply(body, webpackServerMap),
    ).rejects.toThrow('Invalid server reference.');
  });

  it('rejects forged bound arguments in decodeAction and decodeFormState', async () => {
    function greet(name) {
      return 'hi, ' + name;
    }
    const ServerModule = serverExports({greet});
    const body = new FormData();
    body.append('$ACTION_REF_1', '');
    body.append(
      '$ACTION_1:0',
      JSON.stringify({
        id: ServerModule.greet.$$id,
        bound: {then: 'not a promise'},
      }),
    );
    body.append('$ACTION_KEY', 'k');
    expect(() =>
      ReactServerDOMServer.decodeAction(body, webpackServerMap),
    ).toThrow('Invalid server reference.');
    expect(() =>
      ReactServerDOMServer.decodeFormState('state', body, webpackServerMap),
    ).toThrow('Invalid server reference.');
  });
});
