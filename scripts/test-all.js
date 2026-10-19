#!/usr/bin/env node
/**
 * Run each workspace's own vitest config, once.
 *
 * Vitest 4 removed the workspace option, so the root config used to sweep the
 * whole tree. That meant every .test.ts file under src-tauri/webview ran twice —
 * once under the root config (node environment, React 19 peer-resolved from the
 * root) and once under the webview config (jsdom, React 18). The root config now
 * covers shared/ only, and this script runs each project's own config.
 *
 * Usage:
 *   node scripts/test-all.js            — run both
 *   node scripts/test-all.js webview    — run one
 */

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

const projects = {
    shared: root,
    webview: path.join(root, 'src-tauri', 'webview'),
};

const requested = process.argv.slice(2);
const targets = requested.length ? requested : Object.keys(projects);

const unknown = requested.filter(t => !projects[t]);
if (unknown.length) {
    console.error(`Unknown project: ${unknown.join(', ')}`);
    console.error(`Available: ${Object.keys(projects).join(', ')}`);
    process.exit(1);
}

let failed = [];

for (const name of targets) {
    console.log(`\n=== ${name} ===`);
    const result = spawnSync('npx', ['vitest', 'run'], {
        cwd: projects[name],
        stdio: 'inherit',
    });
    if (result.status !== 0) failed.push(name);
}

if (failed.length) {
    console.error(`\nFailed: ${failed.join(', ')}`);
    process.exit(1);
}

console.log(`\nAll ${targets.length} project(s) passed.`);
