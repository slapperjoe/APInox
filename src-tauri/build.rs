fn main() {
  // The app's user-visible version is owned by the ROOT package.json
  // (single source of truth — scripts/version.js bumps it; the webview
  // reads it for __APP_VERSION__). Cargo.toml's [package] version is
  // build metadata only and is NOT synced on release bumps, so expose the
  // real version as a compile-time env var instead of CARGO_PKG_VERSION.
  // A plain regex keeps build.rs dependency-free (no serde_json).
  let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap();
  let root_pkg = std::path::Path::new(&manifest_dir).join("..").join("package.json");
  let pkg = std::fs::read_to_string(&root_pkg)
    .unwrap_or_else(|e| panic!("cannot read {}: {}", root_pkg.display(), e));
  let version = pkg
    .lines()
    .find_map(|line| {
      let trimmed = line.trim();
      if !trimmed.starts_with("\"version\"") {
        return None;
      }
      let rest = trimmed.splitn(2, ':').nth(1)?.trim();
      Some(rest.trim_matches(|c| c == '"' || c == ',').to_string())
    })
    .unwrap_or_else(|| {
      panic!(
        "cannot find \"version\" in {} — add a \"version\": \"x.y.z\" field",
        root_pkg.display()
      )
    });

  println!("cargo:rustc-env=APINOX_APP_VERSION={version}");
  // Re-run build.rs when the version file changes.
  println!("cargo:rerun-if-changed={}", root_pkg.display());

  tauri_build::build()
}
