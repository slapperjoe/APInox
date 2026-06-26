#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER_NAME="apinox"
ASSEMBLE_FILE="${REPO_ROOT}/distrobox.assemble"

cleanup_stale_build_artifacts() {
  local current_uid target_dir stale_entry

  current_uid="$(id -u)"

  for target_dir in "${REPO_ROOT}/target" "${REPO_ROOT}/src-tauri/target"; do
    [[ -d "${target_dir}" ]] || continue

    stale_entry="$(find "${target_dir}" -mindepth 1 ! -uid "${current_uid}" -print -quit 2>/dev/null || true)"
    [[ -n "${stale_entry}" ]] || continue

    echo "[0/3] Removing stale build artifacts from ${target_dir}..."
    podman unshare rm -rf "${target_dir}"
  done
}

echo "=== APInox Distrobox Setup ==="
cleanup_stale_build_artifacts

# Step 1: Create container from assemble file
echo "[1/3] Creating distrobox container..."
distrobox assemble create --file "${ASSEMBLE_FILE}" --name "${CONTAINER_NAME}" || true

# Step 2: Enter container and run setup
echo "[2/3] Running setup inside container..."
distrobox enter "${CONTAINER_NAME}" -- bash "${REPO_ROOT}/scripts/setup.sh"

# Step 3: Verify
echo "[3/3] Verifying tools..."
distrobox enter "${CONTAINER_NAME}" -- bash -c '
  echo "Node.js: $(node --version)"
  echo "npm: $(npm --version)"
  echo "Rust: $(rustc --version)"
  echo "Cargo: $(cargo --version)"
  echo "Tauri CLI: $(npx tauri --version || echo not installed)"
  echo "xdg-open: $(command -v xdg-open || echo missing)"
  echo "fusermount: $(command -v fusermount || echo missing)"
  echo "file: $(command -v file || echo missing)"
  echo "mksquashfs: $(command -v mksquashfs || echo missing)"
  if ldconfig -p 2>/dev/null | grep -q "libfuse.so.2"; then
    echo "libfuse.so.2: present"
  else
    echo "libfuse.so.2: missing"
  fi
'

echo "=== Distrobox container '${CONTAINER_NAME}' is ready ==="
echo "Enter with: distrobox enter ${CONTAINER_NAME}"
