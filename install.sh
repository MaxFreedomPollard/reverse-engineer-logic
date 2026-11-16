#!/bin/bash
{
set -euo pipefail

REPO="MaxFreedomPollard/reverse-engineer-logic"
INSTALL_DIR="${REL_INSTALL_DIR:-$HOME/.local/share/reverse-engineer-logic}"
BIN_DIR="${REL_BIN_DIR:-$HOME/.local/bin}"
RUN_SETUP=true

while (($# > 0)); do
  case "$1" in
    --no-setup) RUN_SETUP=false; shift ;;
    -h|--help)
      echo "Usage: install.sh [--no-setup]"
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

mkdir -p "$INSTALL_DIR" "$BIN_DIR"

if command -v git >/dev/null 2>&1; then
  rm -rf "$INSTALL_DIR"
  git clone --depth 1 "https://github.com/${REPO}.git" "$INSTALL_DIR"
else
  curl -fsSL "https://github.com/${REPO}/archive/refs/heads/main.tar.gz" | tar -xz -C "$INSTALL_DIR" --strip-components=1
fi

chmod +x "$INSTALL_DIR/bin/rel.mjs"
ln -sf "$INSTALL_DIR/bin/rel.mjs" "$BIN_DIR/rel"
ln -sf "$INSTALL_DIR/bin/rel.mjs" "$BIN_DIR/reverse-engineer-logic"

echo "Installed rel -> $BIN_DIR/rel"
if [ "$RUN_SETUP" = true ] && command -v node >/dev/null 2>&1; then
  node "$INSTALL_DIR/bin/rel.mjs" setup --all-detected
fi
}
