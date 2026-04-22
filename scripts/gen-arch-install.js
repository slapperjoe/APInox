#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const bundleDir = path.join(__dirname, '..', 'target', 'release', 'bundle', 'arch');
const releaseAssetsDir = path.join(bundleDir, 'release-assets');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const pkgFile = fs.readdirSync(bundleDir).find(f => f.endsWith('.pkg.tar.zst'));
if (!pkgFile) {
    console.error('❌ No .pkg.tar.zst found in bundle/arch/');
    process.exit(1);
}

const arch = pkgFile.match(/-([^-]+)\.pkg\.tar\.zst$/)?.[1] || 'x86_64';
const releasePkgFile = `apinox-v${pkg.version}-archlinux-${arch}.pkg.tar.zst`;
const installFile = `apinox-v${pkg.version}-archlinux-${arch}-install.sh`;

fs.mkdirSync(releaseAssetsDir, { recursive: true });
fs.copyFileSync(path.join(bundleDir, pkgFile), path.join(releaseAssetsDir, releasePkgFile));

const script = `#!/bin/bash
# APInox ${pkg.version} — Arch Linux installer
sudo pacman -U "$(dirname "$0")/${releasePkgFile}"
`;

const outPath = path.join(releaseAssetsDir, installFile);
fs.writeFileSync(outPath, script, { mode: 0o755 });
console.log(`✅ Generated ${path.join(releaseAssetsDir, releasePkgFile)}`);
console.log(`✅ Generated ${outPath}`);
