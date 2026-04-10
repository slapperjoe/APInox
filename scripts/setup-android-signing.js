#!/usr/bin/env node
/**
 * APInox Android Signing Setup
 *
 * Generates an Android release keystore and pushes the four required
 * secrets to GitHub so the release workflow can sign APKs.
 *
 * Prerequisites:
 *   - Java / keytool must be on PATH  (part of any JDK)
 *   - gh CLI must be authenticated    (gh auth login)
 *
 * Usage:
 *   node scripts/setup-android-signing.js          — generate keystore + push secrets (first time)
 *   node scripts/setup-android-signing.js --pull   — pull existing keystore from GitHub secrets
 *
 * The generated keystore is saved to  ~/.apinox/apinox-release.keystore
 * GitHub secrets are the source of truth — use --pull on any new machine.
 */

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');
const readline = require('readline');

// ── helpers ────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', ...opts }).trim();
}

function check(bin) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin]);
  return result.status === 0;
}

function prompt(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function promptPassword(rl, question) {
  process.stdout.write(question);
  return new Promise(resolve => {
    const stdin = process.stdin;
    const chars = [];
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    function onData(ch) {
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(chars.join(''));
      } else if (ch === '\u0003') { // Ctrl+C
        process.exit(1);
      } else if (ch === '\u007f') { // backspace
        if (chars.length > 0) chars.pop();
      } else {
        chars.push(ch);
      }
    }
    stdin.on('data', onData);
  });
}

const isPull = process.argv.includes('--pull');

// ── preflight ──────────────────────────────────────────────────────────────

console.log(`\n🔐  APInox Android Signing Setup${isPull ? ' (pull mode)' : ''}\n`);

if (!check('gh')) {
  console.error('❌  gh CLI not found. Install from https://cli.github.com/');
  process.exit(1);
}

// Verify gh is authenticated
try {
  run('gh auth status');
} catch {
  console.error('❌  gh CLI is not authenticated. Run: gh auth login');
  process.exit(1);
}

// Detect repo from git remote
let repoSlug;
try {
  const remote = run('git remote get-url origin');
  const m = remote.match(/github\.com[/:](.+?)(\.git)?$/);
  if (!m) throw new Error('Cannot parse remote URL');
  repoSlug = m[1];
} catch {
  console.error('❌  Could not determine GitHub repo from git remote.');
  process.exit(1);
}
console.log(`📦  Repo: ${repoSlug}\n`);

// ── pull mode ──────────────────────────────────────────────────────────────

if (isPull) {
  console.log('⬇️   Pulling keystore from GitHub secrets…\n');

  // gh can't read secret values (write-only by design) — we store the
  // keystore as a regular Actions variable alongside the secrets so it
  // can be retrieved here.  On first setup we write it as a variable too.
  let b64;
  try {
    b64 = run(`gh variable get ANDROID_KEYSTORE_B64 --repo ${repoSlug}`);
  } catch {
    console.error('❌  ANDROID_KEYSTORE_B64 variable not found in repo.');
    console.error('    Run without --pull first to generate and store the keystore.');
    process.exit(1);
  }

  fs.mkdirSync(keystoreDir, { recursive: true });
  fs.writeFileSync(keystorePath, Buffer.from(b64, 'base64'));
  fs.chmodSync(keystorePath, 0o600);

  console.log(`✅  Keystore written to ${keystorePath}`);
  console.log('    You can now build and sign Android APKs locally.\n');
  process.exit(0);
}

const keystoreDir  = path.join(os.homedir(), '.apinox');
const keystorePath = path.join(keystoreDir, 'apinox-release.keystore');

if (fs.existsSync(keystorePath)) {
  console.log(`⚠️   A keystore already exists at ${keystorePath}`);
  console.log('    If you continue, it will be overwritten and GitHub secrets will be updated.');
  console.log('    Only do this if you are intentionally rotating your signing key.\n');
}

// ── gather info ────────────────────────────────────────────────────────────

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

(async () => {
  const alias    = (await prompt(rl, 'Key alias        [apinox]: ')).trim() || 'apinox';
  const dname    = (await prompt(rl, 'Organisation CN  [APInox]: ')).trim() || 'APInox';
  const validity = (await prompt(rl, 'Validity (days)  [10000]:  ')).trim() || '10000';

  let password, passwordConfirm;
  while (true) {
    password        = await promptPassword(rl, 'Keystore password: ');
    passwordConfirm = await promptPassword(rl, 'Confirm password:  ');
    if (password.length < 6) {
      console.log('⚠️   Password must be at least 6 characters.\n');
      continue;
    }
    if (password !== passwordConfirm) {
      console.log('⚠️   Passwords do not match.\n');
      continue;
    }
    break;
  }

  rl.close();

  // ── generate keystore ────────────────────────────────────────────────────

  fs.mkdirSync(keystoreDir, { recursive: true });

  // Remove existing keystore so keytool doesn't prompt to overwrite
  if (fs.existsSync(keystorePath)) fs.unlinkSync(keystorePath);

  console.log('⚙️   Generating keystore…');

  const forge = require('node-forge');

  // Generate 2048-bit RSA key pair
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = Date.now().toString(16);
  cert.validity.notBefore = new Date();
  cert.validity.notAfter  = new Date();
  cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + parseInt(validity));

  const attrs = [
    { name: 'commonName',       value: dname },
    { name: 'organizationName', value: dname },
    { name: 'countryName',      value: 'US'  },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);  // self-signed
  cert.sign(keys.privateKey, forge.md.sha256.create());

  // Pack as PKCS12 — the format Android / keytool uses
  const p12 = forge.pkcs12.toPkcs12Asn1(
    keys.privateKey,
    [cert],
    password,
    { algorithm: '3des', friendlyName: alias },
  );
  const p12Der = Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary');

  fs.mkdirSync(keystoreDir, { recursive: true });
  fs.writeFileSync(keystorePath, p12Der, { mode: 0o600 });
  console.log(`✅  Keystore written to ${keystorePath}`);

  // ── base64 encode ────────────────────────────────────────────────────────

  const keystoreB64 = fs.readFileSync(keystorePath).toString('base64');

  // ── push secrets to GitHub ───────────────────────────────────────────────

  console.log('\n📤  Pushing secrets to GitHub…');

  const secrets = [
    ['ANDROID_KEYSTORE',          keystoreB64],
    ['ANDROID_KEYSTORE_PASSWORD', password],
    ['ANDROID_KEY_ALIAS',         alias],
    ['ANDROID_KEY_PASSWORD',      password],
  ];

  for (const [name, value] of secrets) {
    try {
      spawnSync('gh', ['secret', 'set', name, '--repo', repoSlug, '--body', value], {
        stdio: ['pipe', 'inherit', 'inherit'],
      });
      console.log(`  ✓  secret: ${name}`);
    } catch (err) {
      console.error(`  ❌  Failed to set ${name}:`, err.message);
      process.exit(1);
    }
  }

  // Also store the keystore as a plain repo variable so --pull can retrieve it.
  // (GitHub secrets are write-only and cannot be read back via API.)
  try {
    spawnSync('gh', ['variable', 'set', 'ANDROID_KEYSTORE_B64', '--repo', repoSlug, '--body', keystoreB64], {
      stdio: ['pipe', 'inherit', 'inherit'],
    });
    console.log('  ✓  variable: ANDROID_KEYSTORE_B64 (used by --pull)');
  } catch (err) {
    console.error('  ⚠️   Could not set ANDROID_KEYSTORE_B64 variable:', err.message);
  }

  // ── done ─────────────────────────────────────────────────────────────────

  console.log(`
✅  Done! All four GitHub secrets are set.

   Keystore location : ${keystorePath}
   Source of truth   : GitHub (secrets + ANDROID_KEYSTORE_B64 variable)

   On any other machine, restore the keystore with:
     node scripts/setup-android-signing.js --pull

   The next release workflow run will produce a signed release APK.
`);
})();
