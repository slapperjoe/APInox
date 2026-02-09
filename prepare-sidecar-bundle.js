const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, 'sidecar');
const targetDir = path.join(__dirname, 'sidecar-bundle');

// Clean target
if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true });
}
fs.mkdirSync(targetDir, { recursive: true });

// Copy bundle.js
console.log('Copying bundle.js...');
fs.copyFileSync(
    path.join(sourceDir, 'bundle.js'),
    path.join(targetDir, 'bundle.js')
);

// Copy jsonc-parser from root node_modules
const rootNodeModules = path.join(__dirname, 'node_modules', 'jsonc-parser');
const targetNodeModules = path.join(targetDir, 'node_modules', 'jsonc-parser');

function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        fs.readdirSync(src).forEach(item => {
            copyRecursive(path.join(src, item), path.join(dest, item));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

console.log('Copying jsonc-parser...');
copyRecursive(rootNodeModules, targetNodeModules);

const bundleStats = fs.statSync(path.join(targetDir, 'bundle.js'));
const sizeMB = (bundleStats.size / 1024 / 1024).toFixed(2);

console.log(`Sidecar bundle prepared successfully! (bundle: ${sizeMB} MB + jsonc-parser)`);



