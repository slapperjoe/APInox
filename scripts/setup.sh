#!/bin/bash
set -euo pipefail

# setup.sh - Runs inside the distrobox container
# Installs project dependencies and builds shared packages

REPO_ROOT="/var/home/mark/Code/APInox"
echo "=== APInox Container Setup ==="

# Step 1: Verify Node.js (installed by additional_packages)
echo "[1/3] Checking Node.js..."
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# Step 2: Install project deps
echo "[2/3] Installing project dependencies..."
cd "${REPO_ROOT}"
npm install

# Step 3: Build shared packages
echo "[3/3] Building shared packages..."
npm run build:packages

echo "=== Setup complete ==="
