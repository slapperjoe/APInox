#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const bundleDir = path.join(__dirname, '..', 'target', 'release', 'bundle', 'arch');
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

const pkgFile = fs.readdirSync(bundleDir).find(f => f.endsWith('.pkg.tar.zst'));
if (!pkgFile) {
    console.error('❌ No .pkg.tar.zst found in bundle/arch/');
    process.exit(1);
}

const script = `#!/bin/bash
# APInox ${pkg.version} — Arch Linux installer
sudo pacman -U "$(dirname "$0")/${pkgFile}"
`;

const outPath = path.join(bundleDir, 'install.sh');
fs.writeFileSync(outPath, script, { mode: 0o755 });
console.log(`✅ Generated ${outPath}`);
