#!/usr/bin/env sh
# Download and unpack the dsh-chat-migration plugins so the DSH plugin panel can
# install them from a folder. No GitHub account is needed: these are public files.
#
#   curl -fsSL https://raw.githubusercontent.com/siweimidu/dsh-chat-migration/master/install.sh | sh
#
# Command-line users can skip this and run, for each package:
#   dsh plugin --profile <name> add <release url>
# (`--profile` is required by DSH itself; "desktop" is rejected because the
# Electron app owns that profile - install through the panel instead.)
set -eu

VERSION="${VERSION:-v0.3.0}"
SEMVER="${VERSION#v}"
REPO="siweimidu/dsh-chat-migration"
ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/dsh-chat-migration"

for pkg in conversation-import chat-preset; do
  file="xiaozhuang-dsh-$pkg-$SEMVER.tgz"
  echo "fetching $pkg $VERSION"
  mkdir -p "$ROOT/$pkg"

  ok=0
  for url in \
    "https://github.com/$REPO/releases/download/$VERSION/$file" \
    "https://cdn.jsdelivr.net/gh/$REPO@$VERSION/dist/$file" \
    "https://raw.githubusercontent.com/$REPO/$VERSION/dist/$file"
  do
    if curl -fsSL --max-time 120 -o "$ROOT/$pkg.tgz" "$url"; then
      size=$(wc -c < "$ROOT/$pkg.tgz")
      if [ "$size" -gt 1000 ]; then ok=1; break; fi
    fi
    echo "  unavailable: $url"
  done

  [ "$ok" = 1 ] || { echo "no reachable source for $pkg" >&2; exit 1; }
  rm -rf "$ROOT/$pkg"
  mkdir -p "$ROOT/$pkg"
  tar -xzf "$ROOT/$pkg.tgz" -C "$ROOT/$pkg"
  rm -f "$ROOT/$pkg.tgz"
done

echo
echo "Unpacked. Install from the plugin panel (Settings -> Plugins -> install from local folder):"
for pkg in conversation-import chat-preset; do
  echo "  $ROOT/$pkg/package"
done
