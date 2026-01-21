const fs = require('fs');
const path = require('path');
const os = require('os');

const sidecarDir = path.join(__dirname, 'sidecar');
const targetDir = path.join(__dirname, 'sidecar-bundle');

// Determine platform-specific binary name
const platform = os.platform();
const arch = os.arch();

let binaryName;
if (platform === 'darwin') {
    // macOS - check architecture
    binaryName = arch === 'arm64' ? 'sidecar-bin-macos-arm64' : 'sidecar-bin-macos-x64';
} else if (platform === 'win32') {
    binaryName = 'sidecar-bin-win-x64.exe';
} else if (platform === 'linux') {
    binaryName = 'sidecar-bin-linux-x64';
} else {
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
}

console.log(`Preparing sidecar binary for ${platform} (${arch})...`);
console.log(`Looking for binary: ${binaryName}`);

// Clean target
if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true });
}
fs.mkdirSync(targetDir, { recursive: true });

// Copy the appropriate binary
const sourceBinary = path.join(sidecarDir, binaryName);
const targetBinary = path.join(targetDir, 'sidecar');

if (!fs.existsSync(sourceBinary)) {
    console.error(`Binary not found: ${sourceBinary}`);
    console.error('Please run: cd sidecar && npm run build:binary');
    process.exit(1);
}

console.log(`Copying ${binaryName} to sidecar-bundle/sidecar...`);
fs.copyFileSync(sourceBinary, targetBinary);

// Make executable on Unix systems
if (platform !== 'win32') {
    fs.chmodSync(targetBinary, 0o755);
}

const binaryStats = fs.statSync(targetBinary);
const sizeMB = (binaryStats.size / 1024 / 1024).toFixed(2);

console.log(`✓ Sidecar binary prepared successfully! (${sizeMB} MB)`);
console.log(`  Platform: ${platform}`);
console.log(`  Architecture: ${arch}`);
console.log(`  Binary: ${targetBinary}`);
