#!/usr/bin/env node
/**
 * Tauri Build Wrapper
 *
 * Runs all pre-build steps and then invokes `npx tauri build`,
 * forwarding any extra CLI arguments (e.g. --target <triple>) so that
 * they reach the Tauri CLI instead of being appended to the end of a
 * shell command chain where they would be misinterpreted by Node.js.
 *
 * Usage:
 *   node scripts/tauri-build.js
 *   node scripts/tauri-build.js --target x86_64-pc-windows-msvc
 *   node scripts/tauri-build.js --target aarch64-apple-darwin
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');

// Extra args passed to this script are forwarded verbatim to `tauri build`.
// process.argv: [node, script, ...extra]
const extraArgs = process.argv.slice(2);

function run(cmd, opts = {}) {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
}

// 1. Pre-build steps
run('node scripts/increment-build.js');
run('node scripts/sync-version.js');
run('npm run build:packages');

// 2. Webview dependencies
run('npm install', { cwd: path.join(root, 'src-tauri', 'webview') });

// 3. Tauri build – pass through any extra args (e.g. --target <triple>)
//    Use spawnSync with an argument array to avoid shell injection and to
//    correctly handle arguments that may contain spaces.
console.log(`\n> npx tauri build ${extraArgs.join(' ')}`);
const result = spawnSync('npx', ['tauri', 'build', ...extraArgs], {
    stdio: 'inherit',
    cwd: root,
    shell: true,
});
if (result.status !== 0) {
    process.exit(result.status ?? 1);
}

// 4. On Linux, also produce an Arch Linux package
if (process.platform === 'linux') {
    run('npm run package:arch');
}
