#!/usr/bin/env node
/**
 * APInox Version Management
 *
 * Single script replacing increment-build.js, sync-version.js, bump.js,
 * tauri-build.js, and update_changelog.js.
 *
 * Version = major.minor.<commit count>: the patch component is the number
 * of commits reachable from HEAD (`git rev-list --count HEAD`), so a given
 * commit always yields the same version (reproducible builds) and no
 * counter stored in the tree can drift out of sync. It advances as commits
 * land — never rewrite published main history (force-push / rebase of main
 * itself) or the count can go backwards and the updater will treat a new
 * release as a downgrade.
 *
 * Commands:
 *   node scripts/version.js sync [x.y.z]       — write version to all config files
 *   node scripts/version.js set x.y.z          — force the exact version (release reuse)
 *   node scripts/version.js bump <major|minor> ["msg"] — bump + changelog + git commit + tag
 *   node scripts/version.js build [tauri-args...] — sync + build:packages + tauri build
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");

const root = path.join(__dirname, "..");

const configFiles = {
  rootPackage: path.join(root, "package.json"),
  tauriConfig: path.join(root, "src-tauri", "tauri.conf.json"),
  changelog: path.join(root, "CHANGELOG.md"),
};
// Single source of truth: root package.json.
// - webview __APP_VERSION__ (vite/vitest) reads the ROOT package.json.
// - Rust reads it at build time (src-tauri/build.rs → APINOX_APP_VERSION).
// - tauri.conf.json carries the version for OS bundle metadata and
//   release.yml ("Read bumped version" reads it with jq).
// Intentionally NOT synced:
// - src-tauri/Cargo.toml + Cargo.lock: the crate version is build metadata
//   only; Rust self-identifies from APINOX_APP_VERSION, so bumping the app
//   version no longer churns the lockfile.
// - src-tauri/webview/package.json (+ lock): nothing reads the webview
//   package version at runtime or build time; mirroring it only produced a
//   stale file that re-dirtied the tree on every dev run.

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, ...opts });
}

function wantsLinuxAppImage(extraArgs) {
  if (process.platform !== "linux") {
    return false;
  }

  const bundlesIndex = extraArgs.findIndex((arg) => arg === "--bundles");
  if (bundlesIndex === -1) {
    return true;
  }

  const bundles = (extraArgs[bundlesIndex + 1] || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return bundles.includes("appimage") || bundles.includes("all");
}

function tryFinalizeLinuxAppImage() {
  const tauriConf = JSON.parse(fs.readFileSync(configFiles.tauriConfig, "utf8"));
  const productName = tauriConf.productName || "app";
  const bundleDir = path.join(root, "target", "release", "bundle", "appimage");
  const appDir = path.join(bundleDir, `${productName}.AppDir`);
  const desktopIcon = path.join(appDir, `${productName}.png`);
  const rootIcon = path.join(appDir, productName.toLowerCase() + ".png");
  const pluginPath = path.join(
    process.env.HOME || "",
    ".cache",
    "tauri",
    "linuxdeploy-plugin-appimage.AppImage",
  );

  if (!fs.existsSync(appDir) || !fs.existsSync(desktopIcon) || !fs.existsSync(pluginPath)) {
    return false;
  }

  if (!fs.existsSync(rootIcon)) {
    fs.copyFileSync(desktopIcon, rootIcon);
  }

  console.log("\n> linuxdeploy-plugin-appimage --appdir " + path.basename(appDir));
  const result = spawnSync(pluginPath, ["--appdir", path.basename(appDir)], {
    cwd: bundleDir,
    env: {
      ...process.env,
      APPIMAGE_EXTRACT_AND_RUN: "1",
    },
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  if (result.status !== 0) {
    return false;
  }

  const generatedAppImage = path.join(bundleDir, `${productName}-x86_64.AppImage`);
  if (fs.existsSync(generatedAppImage)) {
    const version = JSON.parse(fs.readFileSync(configFiles.rootPackage, "utf8")).version;
    const tauriStyleName = path.join(bundleDir, `${productName}_${version}_amd64.AppImage`);
    if (generatedAppImage !== tauriStyleName) {
      fs.copyFileSync(generatedAppImage, tauriStyleName);
    }
  }

  return true;
}

// ── commit count ───────────────────────────────────────────────────────────
// The patch component: number of commits reachable from HEAD. Derived from
// git so the version is a pure function of the commit and no counter stored
// in the tree can drift. Requires a full (non-shallow) history — a shallow
// clone would under-report the count.
function commitCount() {
  const shallow = execSync("git rev-parse --is-shallow-repository", {
    cwd: root,
  })
    .toString()
    .trim();
  if (shallow === "true") {
    console.error(
      "❌ Shallow clone: the patch component (commit count) requires full history.\n" +
        "   Run `git fetch --unshallow` (or clone with full depth) and retry.",
    );
    process.exit(1);
  }
  return Number(
    execSync("git rev-list --count HEAD", { cwd: root }).toString().trim(),
  );
}

// ── sync ───────────────────────────────────────────────────────────────────
// Composes major.minor.<commit count> and writes it to the files that are
// actually consumed: root package.json (single source of truth — webview
// __APP_VERSION__ + Rust build.rs) and tauri.conf.json (bundle metadata).
// Cargo.toml / Cargo.lock / webview package.json are no longer mirrored
// (see the configFiles note above).
// The patch component is derived from git (commitCount), so a given commit
// always syncs to the same version — repeated runs are stable no-ops.
function sync(forcedVersion) {
  let targetVersion = forcedVersion;

  if (!targetVersion) {
    const rootPkg = JSON.parse(
      fs.readFileSync(configFiles.rootPackage, "utf8"),
    );
    const parts = rootPkg.version.split(".");
    if (parts.length < 2) {
      console.error("❌ Version in package.json must be at least major.minor");
      process.exit(1);
    }
    targetVersion = `${parts[0]}.${parts[1]}.${commitCount()}`;
  }

  const vParts = targetVersion.split(".");
  if (vParts.length !== 3) {
    console.error("❌ Version must be major.minor.patch");
    process.exit(1);
  }

  console.log(`\n🔄 Syncing all versions to: ${targetVersion}\n`);

  const rootPkg = JSON.parse(fs.readFileSync(configFiles.rootPackage, "utf8"));
  rootPkg.version = targetVersion;
  fs.writeFileSync(
    configFiles.rootPackage,
    JSON.stringify(rootPkg, null, 2) + "\n",
  );
  console.log(`✓ package.json → ${targetVersion}`);

  const tauriConf = JSON.parse(
    fs.readFileSync(configFiles.tauriConfig, "utf8"),
  );
  tauriConf.version = targetVersion;
  fs.writeFileSync(
    configFiles.tauriConfig,
    JSON.stringify(tauriConf, null, 2) + "\n",
  );
  console.log(`✓ src-tauri/tauri.conf.json → ${targetVersion}`);

  console.log("\n✅ Version sync complete.\n");
}

// ── set ────────────────────────────────────────────────────────────────────
// Forces the synced version to an exact value. Used by the release workflow
// when it adopts the version already baked into a build's artifacts (the
// binaries are the ground truth — a rebuild is the only way to produce a
// different number). There is no stored counter to force anymore: the patch
// was already determined by the commit count at build time, so adopting just
// syncs the exact value into the config files. Idempotent: adopting a
// version the tree is already at is a no-op, not an error (the release
// workflow re-runs `set` against an already-synced tree).
function setVersion(version) {
  if (!version || version.split(".").length !== 3) {
    console.error("Usage: node scripts/version.js set <major.minor.patch>");
    process.exit(1);
  }

  const patch = Number(version.split(".")[2]);
  if (!Number.isInteger(patch) || patch < 0) {
    console.error(`❌ Patch component must be a non-negative integer: ${version}`);
    process.exit(1);
  }

  console.log(`✅ Adopting version: ${version}`);
  sync(version);
}

// ── changelog ─────────────────────────────────────────────────────────────
function updateChangelog(version, customMessage) {
  let changelog = "";
  if (fs.existsSync(configFiles.changelog)) {
    changelog = fs.readFileSync(configFiles.changelog, "utf8");
  }

  const date = new Date().toISOString().split("T")[0];
  const header = `## [${version}] - ${date}`;

  if (changelog.includes(header)) {
    console.log("ℹ️  Changelog already has current version header.");
    return;
  }

  let changes = "";
  if (customMessage) {
    changes = `- ${customMessage}`;
  } else {
    try {
      let lastAnchor = "";
      try {
        lastAnchor = execSync('git log -n 1 --format="%H" -- package.json', {
          cwd: root,
        })
          .toString()
          .trim();
      } catch {
        /* no history */
      }

      if (lastAnchor) {
        changes = execSync(
          `git log ${lastAnchor}..HEAD --pretty=format:"- %s"`,
          { cwd: root },
        ).toString();
      } else {
        changes = execSync('git log -n 10 --pretty=format:"- %s"', {
          cwd: root,
        }).toString();
      }
    } catch {
      changes = "- Could not auto-generate changes from git.";
    }
  }

  if (!changes) changes = "- No commit messages found.";
  const entry = `${header}\n### Changes\n${changes}`;

  let newContent = "";
  if (changelog.startsWith("# Changelog")) {
    const lines = changelog.split("\n");
    const headerLines = lines.slice(0, 2).join("\n");
    const rest = lines.slice(2).join("\n");
    newContent = `${headerLines}\n\n${entry}\n${rest}`;
  } else {
    newContent = `${entry}\n${changelog}`;
  }

  fs.writeFileSync(configFiles.changelog, newContent);
  console.log(`✅ Updated CHANGELOG.md with version ${version}`);
}

// ── bump ───────────────────────────────────────────────────────────────────
function bump(type, message) {
  if (!["major", "minor", "patch"].includes(type)) {
    console.error(
      "Usage: node scripts/version.js bump <major|minor> [commit_message]",
    );
    process.exit(1);
  }

  if (type === "patch") {
    // The patch component is derived from the commit count, so it cannot be
    // bumped in isolation — committing is what advances it.
    console.error(
      "❌ 'bump patch' no longer applies: the patch component is the commit count\n" +
        "   (git rev-list --count HEAD). Commit your changes, then run `npm run sync-version`\n" +
        "   (or just build — the version is derived automatically).",
    );
    process.exit(1);
  } else {
    // major/minor: let npm handle the arithmetic; the patch is re-derived
    // from the commit count by sync
    run(`npm version ${type} --no-git-tag-version`);
    run("node scripts/version.js sync");
  }

  const pkg = JSON.parse(fs.readFileSync(configFiles.rootPackage, "utf8"));
  const ver = pkg.version;

  updateChangelog(ver, message);

  run("git add .");
  const msg = message ? `v${ver}: ${message}` : `Bump version to ${ver}`;
  run(`git commit -m "${msg}"`);
  run(`git tag v${ver}`);

  console.log(`\n✅ Bumped to v${ver}\n`);
}

// ── build ──────────────────────────────────────────────────────────────────
function build(extraArgs) {
  run("node scripts/version.js sync");
  run("npm run build:packages");
  run("node scripts/run-npm-install.js src-tauri/webview");

  console.log(`\n> npx tauri build ${extraArgs.join(" ")}`);
  const env = { ...process.env };
  if (process.platform === "linux") {
    env.APPIMAGE_EXTRACT_AND_RUN = "1";
  }
  const result = spawnSync("npx", ["tauri", "build", ...extraArgs], {
    cwd: root,
    shell: true,
    env,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
    if (
      wantsLinuxAppImage(extraArgs)
      && combinedOutput.includes("failed to run linuxdeploy")
      && tryFinalizeLinuxAppImage()
    ) {
      console.log("\n✅ AppImage completed via post-build workaround.");
    } else {
      process.exit(result.status ?? 1);
    }
  }

  // On Linux, produce an Arch Linux package only when makepkg is available
  if (process.platform === "linux") {
    let hasMakepkg = false;
    try {
      execSync("which makepkg", { stdio: "ignore" });
      hasMakepkg = true;
    } catch {
      console.log("ℹ️  makepkg not found, skipping Arch Linux packaging.");
    }
    if (hasMakepkg) {
      run("npm run package:arch");
    }
  }

  // On Linux, run the generated AppImage to verify it launches
  if (process.platform === "linux" && wantsLinuxAppImage(extraArgs)) {
    const tauriConf = JSON.parse(fs.readFileSync(configFiles.tauriConfig, "utf8"));
    const productName = tauriConf.productName || "APInox";
    const bundleDir = path.join(root, "target", "release", "bundle", "appimage");
    const files = fs.existsSync(bundleDir) ? fs.readdirSync(bundleDir) : [];
    const appImageFiles = files
      .filter((f) => f.startsWith(productName) && f.endsWith(".AppImage"))
      .sort()
      .reverse();

    if (appImageFiles.length > 0) {
      const appImage = path.join(bundleDir, appImageFiles[0]);
      console.log(`\n🚀 Launching AppImage: ${appImageFiles[0]}`);
      run(`chmod +x "${appImage}"`);
      console.log(`LD_LIBRARY_PATH=${path.join(bundleDir, "usr", "lib")}`);
      const result = spawnSync(appImage, [], {
        cwd: bundleDir,
        env: {
          ...process.env,
          LD_LIBRARY_PATH: path.join(bundleDir, "usr", "lib"),
        },
        stdio: "inherit",
        windowsHide: true,
        timeout: 15000,
      });
      if (result.error && result.error.code === "ETIMEDOUT") {
        console.log(
          "ℹ️  AppImage launch smoke-test hit its 15s limit and was closed — the binary started successfully.",
        );
      }
      console.log(`AppImage exited with code: ${result.status}`);
    } else {
      console.log("ℹ️  No AppImage found to run.");
    }
  }
}

// ── dispatch ───────────────────────────────────────────────────────────────
const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case "sync":
    sync(args[0]);
    break;
  case "set":
    setVersion(args[0]);
    break;
  case "bump":
    bump(args[0], args.slice(1).join(" "));
    break;
  case "build":
    build(args);
    break;
  default:
    console.error(`Unknown command: ${cmd}`);
    console.error(
      "Commands: sync [x.y.z] | set x.y.z | bump <major|minor> [msg] | build [tauri-args...]",
    );
    process.exit(1);
}
