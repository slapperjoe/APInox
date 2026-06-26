#!/bin/bash
set -euo pipefail

# setup.sh - Runs inside the distrobox container
# Installs project dependencies and builds shared packages

REPO_ROOT="/var/home/mark/code/APInox"
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

# Configure zsh prompt to show container name when in distrobox
ZSHRC_FILE="/home/mark/.zshrc"
if [[ -f "$ZSHRC_FILE" ]]; then
  if ! grep -q "CONTAINER_ID" "$ZSHRC_FILE"; then
    printf '\n# Distrobox: show container name in prompt\n' >> "$ZSHRC_FILE"
    printf 'if [[ -n "${CONTAINER_ID:-}" ]]; then\n' >> "$ZSHRC_FILE"
    printf '  PS1="%%n@${CONTAINER_ID}:%%~%%# "\n' >> "$ZSHRC_FILE"
    printf 'fi\n' >> "$ZSHRC_FILE"
  fi
else
  printf '# Distrobox: show container name in prompt\n' > "$ZSHRC_FILE"
  printf 'if [[ -n "${CONTAINER_ID:-}" ]]; then\n' >> "$ZSHRC_FILE"
  printf '  PS1="%%n@${CONTAINER_ID}:%%~%%# "\n' >> "$ZSHRC_FILE"
  printf 'fi\n' >> "$ZSHRC_FILE"
fi

echo "=== Setup complete ==="
