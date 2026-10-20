#!/usr/bin/env node
/**
 * Lint ratchet.
 *
 * ESLint has no baseline concept, so a rule promoted to `error` cannot gate CI
 * while the tree still has findings from it. This script stores the current
 * per-rule counts in `lint-baseline.json` and fails only when a rule gets
 * WORSE. Improvements are allowed, and `--update` records the new lower counts
 * so the ceiling can never creep back up.
 *
 * Usage:
 *   node scripts/lint-baseline.js            — compare against the baseline
 *   node scripts/lint-baseline.js --update   — record current counts as baseline
 *
 * The baseline is deliberately per-rule rather than a single total: a total can
 * stay flat while one rule improves and another regresses, which is exactly the
 * drift this is meant to prevent.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const baselinePath = path.join(root, 'lint-baseline.json');
// 'packages' is no longer a lint target: the request-editor was folded into the
// webview source tree (7ec84084), leaving only the Rust wsdl-parser crate there,
// and ESLint 10 hard-errors when every file under a target is ignored.
const targets = ['src-tauri/webview/src', 'shared'];

// ESLint exits non-zero when any error is present, which is the normal state
// while the baseline is non-empty — so read stdout rather than the exit code.
const run = spawnSync(
    path.join(root, 'node_modules', '.bin', 'eslint'),
    [...targets, '-f', 'json', '--max-warnings', '100000'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
);

if (!run.stdout) {
    console.error(run.stderr || 'ESLint produced no output');
    process.exit(1);
}

const results = JSON.parse(run.stdout);const counts = {};
for (const file of results) {
    for (const msg of file.messages) {
        const rule = msg.ruleId || 'unassigned';
        counts[rule] = (counts[rule] || 0) + 1;
    }
}

const update = process.argv.includes('--update');

if (!fs.existsSync(baselinePath)) {
    fs.writeFileSync(baselinePath, JSON.stringify(counts, null, 2) + '\n');
    console.log(`Baseline created: ${Object.values(counts).reduce((a, b) => a + b, 0)} problems`);
    process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

if (update) {
    fs.writeFileSync(baselinePath, JSON.stringify(counts, null, 2) + '\n');
    console.log('Baseline updated to current counts.');
    process.exit(0);
}

const regressions = [];
const improvements = [];

for (const [rule, count] of Object.entries(counts)) {
    const allowed = baseline[rule] || 0;
    if (count > allowed) regressions.push({ rule, count, allowed, delta: count - allowed });
    else if (count < allowed) improvements.push({ rule, from: allowed, to: count });
}

// Rules that reached zero are removed from the baseline so they cannot reappear
// without being noticed.
for (const rule of Object.keys(baseline)) {
    if (!counts[rule] && baseline[rule] > 0) improvements.push({ rule, from: baseline[rule], to: 0 });
}

if (improvements.length) {
    console.log('Improvements (run `node scripts/lint-baseline.js --update` to bank them):');
    for (const i of improvements.sort((a, b) => (b.from - b.to) - (a.from - a.to))) {
        console.log(`  ${i.rule}: ${i.from} -> ${i.to}`);
    }
}

if (regressions.length) {
    console.error('Lint regressions:');
    for (const r of regressions.sort((a, b) => b.delta - a.delta)) {
        console.error(`  ${r.rule}: ${r.allowed} allowed, ${r.count} found (+${r.delta})`);
    }
    process.exit(1);
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`Lint within baseline (${total} problems).`);
