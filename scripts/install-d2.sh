#!/usr/bin/env bash
# Fetch the d2 binary into ./bin/d2. Required by vitepress-plugin-d2,
# which shells out to `d2` at build time. The binary itself is gitignored.
set -euo pipefail

VERSION="${D2_VERSION:-v0.7.1}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${REPO_ROOT}/bin/d2"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64)  asset="d2-${VERSION}-linux-amd64.tar.gz" ;;
  Linux-aarch64) asset="d2-${VERSION}-linux-arm64.tar.gz" ;;
  Darwin-x86_64) asset="d2-${VERSION}-macos-amd64.tar.gz" ;;
  Darwin-arm64)  asset="d2-${VERSION}-macos-arm64.tar.gz" ;;
  *) echo "unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

url="https://github.com/terrastruct/d2/releases/download/${VERSION}/${asset}"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

echo "fetching ${url}"
curl -fSL "$url" -o "${tmpdir}/d2.tar.gz"
tar -xzf "${tmpdir}/d2.tar.gz" -C "$tmpdir"

mkdir -p "${REPO_ROOT}/bin"
install -m 0755 "${tmpdir}"/d2-*/bin/d2 "$DEST"

echo "installed: $("$DEST" --version)"
echo "         → $DEST"
