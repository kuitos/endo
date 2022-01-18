// @ts-check
/// <reference types="ses"/>
/* global process */

// Establish a perimeter:
import '@agoric/babel-standalone';
import 'ses';
import '@endo/eventual-send/shim.js';
import '@endo/lockdown/commit.js';

import net from 'net';
import fs from 'fs';
import path from 'path';
import { Far } from '@endo/far';
import { whereEndo } from '@endo/where';
import { makePromiseKit } from '@endo/promise-kit';

import { makeCapTPWithConnection } from './src/connection.js';

const { quote: q } = assert;

const { promise: cancelled, reject: cancel } = makePromiseKit();

/** @param {Error} error */
const sinkError = error => {
  console.error(error);
};

const publicFacet = Far('Endo public facet', {});

const privateFacet = Far('Endo private facet', {
  async shutdown() {
    console.error('Endo received shutdown request');
    cancel(new Error('Shutdown'));
  },
});

const bootstrap = harden({
  publicFacet,
  privateFacet,
});

export const main = async () => {
  process.once('exit', () => {
    console.error('Endo exiting');
  });

  const endoPath = whereEndo(process.platform, process.env);
  const sockPath = path.join(endoPath, 'endo.sock');

  await fs.promises.mkdir(path.dirname(sockPath), { recursive: true });

  const server = net.createServer();

  server.listen(
    {
      path: sockPath,
    },
    () => {
      console.log(`Listening on ${q(sockPath)} ${new Date().toISOString()}`);
      // Inform parent that we have an open unix domain socket, if we were
      // spawned with IPC.
      if (process.send) {
        process.send({ type: 'listening', path: sockPath });
      }
    },
  );
  server.on('error', error => {
    sinkError(error);
    process.exit(-1);
  });
  server.on('connection', conn => {
    const { drained } = makeCapTPWithConnection('Endo', conn, bootstrap);
    drained.catch(sinkError);
  });

  cancelled.catch(() => {
    server.close();
  });
};

main().catch(sinkError);
