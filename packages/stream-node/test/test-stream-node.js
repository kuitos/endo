// @ts-check
/* global setTimeout */

import 'ses';
import './lockdown.js';

import rawTest from 'ava';
import { wrapTest } from '@endo/ses-ava';

import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import { makeNodeReader, makeNodeWriter } from '../index.js';

const test = wrapTest(rawTest);

const catPath = fileURLToPath(new URL('cat.js', import.meta.url).toString());

test('stream to and from Node.js reader/writer', async (/** @type {import('ava').ExecutionContext} */ t) => {
  const scratch = new Uint8Array(1024 * 1024);
  for (let i = 0; i < scratch.byteLength; i += 1) {
    scratch[i] = i % 256;
  }

  const child = fork(catPath, {
    stdio: ['pipe', 'pipe', 'inherit', 'ipc'],
  });

  // Call Symbol.asyncIterator in a barefaced attempt to get test coverage
  // through a superfluous method call.
  const writer = makeNodeWriter(child.stdin)[Symbol.asyncIterator]();
  const reader = makeNodeReader(child.stdout)[Symbol.asyncIterator]();

  // We send an IPC message to begin forwarding.
  let flowing = false;

  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', resolve);
  });

  const ipcReady = new Promise(resolve => {
    child.on('message', resolve);
  });

  const makeProducer = async () => {
    let chunkLength = 1;
    for (let i = 0; i < scratch.byteLength; ) {
      const j = i + chunkLength;
      t.log('->', i, j);

      const nextP = writer.next(scratch.subarray(i, j));
      if (
        !flowing &&
        child.stdin.writableLength >= child.stdin.writableHighWaterMark
      ) {
        // eslint-disable-next-line no-await-in-loop
        await ipcReady;
        t.log('---');
        flowing = true;
        // Child will buffer stdin until called for, allowing us to verify and
        // cover write stream pressure.
        child.send({});
      }
      // eslint-disable-next-line no-await-in-loop
      await nextP;

      i = j;
      chunkLength *= 2;
    }
    await writer.return();
  };

  const makeConsumer = async () => {
    let i = 0;
    for await (const chunk of reader) {
      t.assert(flowing);
      const j = i + chunk.byteLength;
      t.log('<-', i, j);
      t.deepEqual(chunk, scratch.subarray(i, j));
      i = j;
    }
    t.is(i, scratch.byteLength);
  };

  await Promise.all([makeProducer(), makeConsumer(), exited]);
});

test('stream read return', async (/** @type {import('ava').ExecutionContext} */ t) => {
  const scratch = new Uint8Array(1024 * 128);
  for (let i = 0; i < scratch.byteLength; i += 1) {
    scratch[i] = i % 256;
  }

  const child = fork(catPath, {
    // Note: ignoring stderr. Node.js barfs as expected when we close its
    // output stream in this test.
    stdio: ['pipe', 'pipe', 'ignore', 'ipc'],
  });
  const reader = makeNodeReader(child.stdout);
  const writer = makeNodeWriter(child.stdin);

  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', resolve);
  });

  // Begin forwarding whenever ready:
  child.on('message', () => {
    child.send({});
  });

  const makeProducer = async () => {
    await writer.next(scratch);
    await writer.return();
  };

  const makeConsumer = async () => {
    // Consumer aborts the stream.
    await reader.return();
  };

  await Promise.allSettled([makeProducer(), makeConsumer(), exited]);
  t.pass();
});

test('stream read throw', async (/** @type {import('ava').ExecutionContext} */ t) => {
  const scratch = new Uint8Array(1024 * 128);
  for (let i = 0; i < scratch.byteLength; i += 1) {
    scratch[i] = i % 256;
  }

  const child = fork(catPath, {
    // Note: ignoring stderr. Node.js barfs as expected when we close its
    // output stream in this test.
    stdio: ['pipe', 'pipe', 'ignore', 'ipc'],
  });
  const reader = makeNodeReader(child.stdout);
  const writer = makeNodeWriter(child.stdin);

  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', resolve);
  });

  // Begin forwarding whenever ready:
  child.on('message', () => {
    child.send({});
  });

  const makeProducer = async () => {
    await writer.next(scratch);
    await writer.return();
  };

  const makeConsumer = async () => {
    // Consumer aborts the stream.
    await reader.throw(new Error('Abort!'));
  };

  await Promise.allSettled([makeProducer(), makeConsumer(), exited]);
  t.pass();
});

test('stream write error (EPIPE due to exit)', async (/** @type {import('ava').ExecutionContext} */ t) => {
  const scratch = new Uint8Array(1024 * 128);
  for (let i = 0; i < scratch.byteLength; i += 1) {
    scratch[i] = i % 256;
  }

  const child = fork(catPath, {
    stdio: ['pipe', 'pipe', 'inherit', 'ipc'],
  });
  const writer = makeNodeWriter(child.stdin);

  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', resolve);
  });

  const makeProducer = async () => {
    let chunkLength = 1;
    for (let i = 0; i < scratch.byteLength; ) {
      const j = i + chunkLength;
      t.log('->', i, j);

      // eslint-disable-next-line no-await-in-loop
      await writer.next(scratch.subarray(i, j));

      i = j;
      chunkLength *= 2;
    }
    await writer.return();
  };

  setTimeout(() => {
    child.kill();
  }, 100);

  // On Linux and Windows, the producer exits gracefully.
  // On Darwin, the producer dies in an EPIPE fire.
  await makeProducer().catch(() => {});
  await exited.catch(() => {});

  t.pass();
});

test('stream writer abort', async (/** @type {import('ava').ExecutionContext} */ t) => {
  const scratch = new Uint8Array(1024 * 128);
  for (let i = 0; i < scratch.byteLength; i += 1) {
    scratch[i] = i % 256;
  }

  const child = fork(catPath, {
    stdio: ['pipe', 'pipe', 'inherit', 'ipc'],
  });
  const writer = makeNodeWriter(child.stdin);
  const reader = makeNodeReader(child.stdout);

  const exited = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', resolve);
  });

  child.on('message', (/** @type {Object} */ message) => {
    if (message.type === 'ready') {
      child.send({ type: 'forward' });
    }
  });

  const makeProducer = async () => {
    try {
      await writer.throw(new Error('Abort'));
    } catch (error) {
      t.is(error.message, 'Abort');
    }
  };

  const makeConsumer = async () => {
    for await (const _ of reader) {
      // eslint-disable-next-line no-empty
    }
  };

  await Promise.all([makeProducer(), makeConsumer(), exited]);
  t.pass();
});
