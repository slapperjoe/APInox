#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const npmCommand = 'npm';
const cargoCommand = 'cargo';

const steps = [
  {
    title: 'Installing root npm dependencies',
    command: npmCommand,
    args: ['ci'],
    cwd: repoRoot,
  },
  {
    title: 'Installing request-editor npm dependencies',
    command: npmCommand,
    args: ['ci'],
    cwd: path.join(repoRoot, 'packages', 'request-editor'),
  },
  {
    title: 'Installing webview npm dependencies',
    command: npmCommand,
    args: ['ci'],
    cwd: path.join(repoRoot, 'src-tauri', 'webview'),
  },
  {
    title: 'Fetching Cargo workspace dependencies',
    command: cargoCommand,
    args: ['fetch', '--locked'],
    cwd: repoRoot,
  },
];

function runStep(step, index) {
  const prefix = `[${index + 1}/${steps.length}]`;
  console.log(`\n${prefix} ${step.title}`);

  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.error(`\n❌ ${step.title} failed: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n❌ ${step.title} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

console.log('Preparing APInox for Tauri development...');

steps.forEach(runStep);

console.log('\n✅ APInox dependencies are installed. You can now run `npm run tauri:dev`.');
