#!/usr/bin/env sh
# One-line install for dsh-chat-migration on macOS / Linux.
#
#   curl -fsSL https://cdn.jsdelivr.net/gh/siweimidu/dsh-chat-migration@master/install-oneline.sh | sh
#
# Downloads over the normal network stack (the DSH plugin panel has its own egress),
# then copies the packages into the profile's node_modules and registers them in
# dsh.profile.bundles: no pnpm, no npm account, no proxy, no profile name to type.
#
# Override the target profile:  DSH_PLUGIN_PROFILE=web sh install-oneline.sh
set -eu

VERSION="${DSH_PLUGIN_VERSION:-v0.3.0}"
SEMVER="${VERSION#v}"
REPO="siweimidu/dsh-chat-migration"
SCOPE="@siweimidu"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILES="$DSH_HOME/profiles"

[ -d "$PROFILES" ] || { echo "DSH profiles folder not found: $PROFILES" >&2; exit 1; }

TARGET="${DSH_PLUGIN_PROFILE:-}"
if [ -z "$TARGET" ]; then
  if [ -d "$PROFILES/desktop" ]; then
    TARGET=desktop
  else
    TARGET=$(ls "$PROFILES" | grep -v '^node_modules$' | head -1)
  fi
fi
[ -n "$TARGET" ] || { echo "no profile found under $PROFILES" >&2; exit 1; }
PROFILE_DIR="$PROFILES/$TARGET"
[ -d "$PROFILE_DIR" ] || { echo "profile folder missing: $PROFILE_DIR" >&2; exit 1; }

echo "DSH home : $DSH_HOME"
echo "profile  : $TARGET"
echo

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

fetch() {
  name="$1"
  file="siweimidu-$name-$SEMVER.tgz"
  for url in \
    "https://registry.npmmirror.com/$SCOPE/$name/-/$name-$SEMVER.tgz" \
    "https://registry.npmjs.org/$SCOPE/$name/-/$name-$SEMVER.tgz" \
    "https://cdn.jsdelivr.net/gh/$REPO@$VERSION/dist/$file" \
    "https://ghfast.top/https://github.com/$REPO/releases/download/$VERSION/$file" \
    "https://github.com/$REPO/releases/download/$VERSION/$file" \
    "https://raw.githubusercontent.com/$REPO/$VERSION/dist/$file"
  do
    if curl -fsSL --max-time 120 -o "$TMP/$file" "$url"; then
      if [ "$(wc -c < "$TMP/$file")" -gt 1000 ]; then
        echo "  ok   $(echo "$url" | cut -d/ -f3)"
        return 0
      fi
    fi
    echo "  skip $(echo "$url" | cut -d/ -f3)"
  done
  echo "every download source failed for $name" >&2
  return 1
}

INSTALLED=""
for name in conversation-import chat-preset; do
  echo "fetching $name"
  fetch "$name"
  file="siweimidu-$name-$SEMVER.tgz"
  mkdir -p "$TMP/$name"
  tar -xzf "$TMP/$file" -C "$TMP/$name"
  [ -f "$TMP/$name/package/package.json" ] || { echo "$name has no package.json" >&2; exit 1; }

  mkdir -p "$PROFILE_DIR/node_modules/$SCOPE"
  rm -rf "$PROFILE_DIR/node_modules/$SCOPE/$name"
  cp -R "$TMP/$name/package" "$PROFILE_DIR/node_modules/$SCOPE/$name"
  echo "  into $PROFILE_DIR/node_modules/$SCOPE/$name"
  INSTALLED="$INSTALLED $SCOPE/$name"
done

MANIFEST="$PROFILE_DIR/package.json"
if [ -f "$MANIFEST" ]; then
  cp "$MANIFEST" "$MANIFEST.bak"
else
  printf '{"name":"dsh-profile-%s","private":true}\n' "$TARGET" > "$MANIFEST"
fi

cat > "$TMP/register.mjs" <<'EOF'
import { readFileSync, writeFileSync } from 'node:fs'
const [path, ...ids] = process.argv.slice(2)
const manifest = JSON.parse(readFileSync(path, 'utf8'))
manifest.dsh ??= {}
manifest.dsh.profile ??= {}
const bundles = Array.isArray(manifest.dsh.profile.bundles) ? manifest.dsh.profile.bundles : []
for (const id of ids) if (!bundles.includes(id)) bundles.push(id)
manifest.dsh.profile.bundles = bundles
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`)
EOF

node "$TMP/register.mjs" "$MANIFEST" $INSTALLED

echo
echo "installed into profile '$TARGET':"
for id in $INSTALLED; do echo "  $id"; done
echo
echo 'Fully quit DSH and start it again; Settings will show the "Import conversations" section.'
echo "Rollback: restore $MANIFEST.bak and delete $PROFILE_DIR/node_modules/$SCOPE"
