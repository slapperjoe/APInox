#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER_NAME="apinox"
ASSEMBLE_FILE="${REPO_ROOT}/distrobox.assemble"

echo "=== APInox Distrobox Setup ==="

# Step 1: Create container from assemble file
echo "[1/3] Creating distrobox container..."
distrobox assemble create --file "${ASSEMBLE_FILE}" --name "${CONTAINER_NAME}" --replace || true

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
'

echo "=== Distrobox container '${CONTAINER_NAME}' is ready ==="
echo "Enter with: distrobox enter ${CONTAINER_NAME}"
