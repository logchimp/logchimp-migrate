#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const platform = process.platform;
const arch = process.arch;

let binaryName = 'logchimp-migrate';
if (platform === 'win32') {
  binaryName += '.exe';
}

const distBinaryPath = join('dist', `logchimp-migrate-${platform}-${arch}${platform === 'win32' ? '.exe' : ''}`);

if (!existsSync(distBinaryPath)) {
  console.error(`Binary not found: ${distBinaryPath}`);
  console.error('Please run: bun run build:all');
  process.exit(1);
}

if (!existsSync('bin')) {
  mkdirSync('bin', { recursive: true });
}

copyFileSync(distBinaryPath, join('bin', binaryName));
console.log(`Copied ${distBinaryPath} to bin/${binaryName}`);
