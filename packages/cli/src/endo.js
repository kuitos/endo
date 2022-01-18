/* global process */
import url from 'url';
import rawFs from 'fs';

import { Command } from 'commander';
import { start, stop, restart } from '@endo/daemon';
import { whereEndo } from '@endo/where';

const fs = rawFs.promises;

const packageDescriptorPath = url.fileURLToPath(
  new URL('../package.json', import.meta.url),
);

export const main = async rawArgs => {
  const program = new Command();

  program.storeOptionsAsProperties(false);

  const packageDescriptorBytes = await fs.readFile(packageDescriptorPath);
  const packageDescriptor = JSON.parse(packageDescriptorBytes);
  program.name(packageDescriptor.name).version(packageDescriptor.version);

  program.command('where').action(async _cmd => {
    const endoPath = whereEndo(process.platform, process.env);
    console.log(endoPath);
  });

  program.command('start').action(async _cmd => {
    await start();
  });

  program.command('stop').action(async _cmd => {
    await stop();
  });

  program.command('restart').action(async _cmd => {
    await restart();
  });

  // Throw an error instead of exiting directly.
  program.exitOverride();

  try {
    await program.parse(rawArgs, { from: 'user' });
  } catch (e) {
    if (e && e.name === 'CommanderError') {
      return e.exitCode;
    }
    throw e;
  }
  return 0;
};
