// @ts-check
/* global process */

// Establish a perimeter:
import '@agoric/babel-standalone';
import 'ses';
import '@endo/eventual-send/shim.js';
import '@endo/lockdown/commit.js';

import url from 'url';
import path from 'path';
import popen from 'child_process';
import fs from 'fs';

import { E } from '@endo/eventual-send';
import { whereEndo } from '@endo/where';
import { makeEndoClient } from './src/client.js';

export { makeEndoClient } from './src/client.js';

const endoPath = whereEndo(process.platform, process.env);
const logPath = path.join(endoPath, 'endo.log');
const sockPath = path.join(endoPath, 'endo.sock');
const endoDaemonPath = url.fileURLToPath(new URL('daemon.js', import.meta.url));

export const shutdown = async () => {
  const { getBootstrap, finalize } = await makeEndoClient(
    'harbinger',
    sockPath,
  );
  const bootstrap = getBootstrap();
  await E(E.get(bootstrap).privateFacet).shutdown();
  finalize();
};

export const start = async () => {
  const output = fs.openSync(logPath, 'a');
  const child = popen.fork(endoDaemonPath, {
    detached: true,
    stdio: ['ignore', output, output, 'ipc'],
  });
  return new Promise(resolve => {
    child.on('message', _message => {
      child.disconnect();
      child.unref();
      resolve();
    });
  });
};

export const clean = async () => {
  await fs.promises.unlink(sockPath);
};

export const restart = async () => {
  if (restart) {
    await shutdown().catch(() => {});
    await clean().catch(() => {});
  }
  return start();
};

export const stop = async () => {
  return shutdown().catch(error => console.error(error));
};
