const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');

// Read version
const packageJson = require(packageJsonPath);
const version = packageJson.version;

// Read changelog
let changelog = '';
if (fs.existsSync(changelogPath)) {
    changelog = fs.readFileSync(changelogPath, 'utf8');
}

const { execSync } = require('child_process');

// Generate header
const date = new Date().toISOString().split('T')[0];
const header = `## [${version}] - ${date}`;

// Fetch git logs
let changes = '';
try {
    // Try to find the last tag to diff against
    let lastTag = '';
    try {
        lastTag = execSync('git describe --tags --abbrev=0 2>nul').toString().trim();
        // If the current version is the same as the last tag (re-running script), find the one before?
        // For now, simpler: just get log.
    } catch (e) {
        // No tags found
    }

    if (lastTag) {
        changes = execSync(`git log ${lastTag}..HEAD --pretty=format:"- %s"`).toString();
    } else {
        // Fallback if no tags: get last 10 commits?
        changes = execSync('git log -n 10 --pretty=format:"- %s"').toString();
    }
} catch (e) {
    changes = '- Could not auto-generate changes from git.';
}

if (!changes) changes = '- No Commit messages found.';
const entry = `${header}\n### Auto-Generated Changes\n${changes}`;


// Check if already exists
if (changelog.includes(header)) {
    console.log('Changelog already has current version header.');
    process.exit(0);
}

// Prepend
// If file starts with "# Changelog", preserve it
let newContent = '';
if (changelog.startsWith('# Changelog')) {
    const lines = changelog.split('\n');
    // Keep first 2 lines (Header + Empty line)
    const headerLines = lines.slice(0, 2).join('\n');
    const rest = lines.slice(2).join('\n');
    newContent = `${headerLines}\n\n${entry}\n${rest}`;
} else {
    newContent = `${entry}\n${changelog}`;
}

fs.writeFileSync(changelogPath, newContent);
console.log(`Updated CHANGELOG.md with version ${version}`);
