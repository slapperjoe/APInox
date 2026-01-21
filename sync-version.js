#!/usr/bin/env node
/**
 * Sync version numbers across all package.json, Cargo.toml, and tauri.conf.json files
 * Usage: node sync-version.js [version]
 * If no version specified, uses root package.json version
 */

const fs = require('fs');
const path = require('path');

const rootDir = __dirname;

// Files to update
const files = {
    rootPackage: path.join(rootDir, 'package.json'),
    sidecarPackage: path.join(rootDir, 'sidecar', 'package.json'),
    webviewPackage: path.join(rootDir, 'webview', 'package.json'),
    cargo: path.join(rootDir, 'src-tauri', 'Cargo.toml'),
    tauriConfig: path.join(rootDir, 'src-tauri', 'tauri.conf.json')
};

// Get target version
let targetVersion = process.argv[2];
if (!targetVersion) {
    const rootPackage = JSON.parse(fs.readFileSync(files.rootPackage, 'utf8'));
    targetVersion = rootPackage.version;
}

console.log(`\n🔄 Syncing all versions to: ${targetVersion}\n`);

// Update root package.json
const rootPackage = JSON.parse(fs.readFileSync(files.rootPackage, 'utf8'));
rootPackage.version = targetVersion;
fs.writeFileSync(files.rootPackage, JSON.stringify(rootPackage, null, 2) + '\n');
console.log(`✓ Updated root package.json to ${targetVersion}`);

// Update sidecar package.json
const sidecarPackage = JSON.parse(fs.readFileSync(files.sidecarPackage, 'utf8'));
sidecarPackage.version = targetVersion;
fs.writeFileSync(files.sidecarPackage, JSON.stringify(sidecarPackage, null, 2) + '\n');
console.log(`✓ Updated sidecar/package.json to ${targetVersion}`);

// Update webview package.json
const webviewPackage = JSON.parse(fs.readFileSync(files.webviewPackage, 'utf8'));
webviewPackage.version = targetVersion;
fs.writeFileSync(files.webviewPackage, JSON.stringify(webviewPackage, null, 2) + '\n');
console.log(`✓ Updated webview/package.json to ${targetVersion}`);

// Update Cargo.toml
let cargoContent = fs.readFileSync(files.cargo, 'utf8');
cargoContent = cargoContent.replace(/^version = ".+"$/m, `version = "${targetVersion}"`);
fs.writeFileSync(files.cargo, cargoContent);
console.log(`✓ Updated src-tauri/Cargo.toml to ${targetVersion}`);

// Update tauri.conf.json
const tauriConfig = JSON.parse(fs.readFileSync(files.tauriConfig, 'utf8'));
tauriConfig.version = targetVersion;
fs.writeFileSync(files.tauriConfig, JSON.stringify(tauriConfig, null, 2) + '\n');
console.log(`✓ Updated src-tauri/tauri.conf.json to ${targetVersion}`);

console.log(`\n✅ All versions synced to ${targetVersion}\n`);
