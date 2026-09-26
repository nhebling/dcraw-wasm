#!/usr/bin/env bash
# Release dcraw-wasm from a clean tree so bin/build-info.json records "dirty": false.
#
# Usage: npm run release -- <patch|minor|major|x.y.z>
#
# Order: preflight checks -> bump + commit + tag (local) -> npm publish
# (runs prepublishOnly: build:prod, test, test:pack) -> push -> GitHub release.
# Publishing happens before pushing, so a failed build/test leaves only a local
# commit and tag that are easy to undo.

set -euo pipefail

cd "$(dirname "$0")/.."

fail() { echo "✖ $*" >&2; exit 1; }
step() { echo; echo "▶ $*"; }

bump="${1:-}"
[[ "$bump" =~ ^(patch|minor|major|[0-9]+\.[0-9]+\.[0-9]+)$ ]] \
	|| fail "Usage: npm run release -- <patch|minor|major|x.y.z>"

# --- Preflight -------------------------------------------------------------

step "Preflight checks"

[[ -z "$(git status --porcelain)" ]] \
	|| fail "Working tree is dirty. Commit or stash your changes first:
$(git status --short)"

branch="$(git rev-parse --abbrev-ref HEAD)"
[[ "$branch" == "main" ]] || fail "Releases are made from main (current: $branch)."

git fetch --quiet origin main
[[ "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]] \
	|| fail "Local main differs from origin/main. Pull or push first."

pinned="$(tr -d '[:space:]' < .emscripten-version)"
installed="$(emcc --version 2>/dev/null | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
[[ -n "$installed" ]] || fail "emcc not found. See README > Prepare (Required tools)."
[[ "$installed" == "$pinned" ]] \
	|| fail "emcc $installed does not match .emscripten-version ($pinned)."

npm whoami > /dev/null 2>&1 || fail "Not logged in to npm. Run: npm login"

current="$(node -p "require('./package.json').version")"
if [[ "$bump" =~ ^[0-9] ]]; then
	next="$bump"
else
	next="$(npx --yes semver "$current" -i "$bump")"
fi

git rev-parse -q --verify "refs/tags/$next" > /dev/null && fail "Tag $next already exists."
grep -q "^## \[$next\]" CHANGELOG.md || fail "CHANGELOG.md has no '## [$next]' section."

echo "  emcc $installed (pinned), npm user $(npm whoami)"
echo "  $current -> $next"
read -r -p "Release $next? [y/N] " answer
[[ "$answer" =~ ^[Yy]$ ]] || fail "Aborted."

# --- Bump, commit, tag (local only) ---------------------------------------

step "Commit and tag $next"

if [[ "$next" == "$current" ]]; then
	# Version already bumped and committed by hand: only tag.
	git tag -a "$next" -m "Release $next"
else
	npm version "$next" --tag-version-prefix="" -m "Release %s"
fi

# --- Publish (prepublishOnly builds and tests) -----------------------------

step "Publish to npm"

if ! npm publish; then
	echo >&2
	echo "✖ npm publish failed. Nothing was pushed. To undo the local release commit/tag:" >&2
	echo "    git tag -d $next" >&2
	[[ "$next" != "$current" ]] && echo "    git reset --hard HEAD~1" >&2
	exit 1
fi

node -e "const i=require('./bin/build-info.json'); if (i.dirty) { console.error('warning: build-info.json says dirty: true'); }" 2>/dev/null || true

# --- Push and create GitHub release ----------------------------------------

step "Push commit and tag"

git push origin main
git push origin "$next"

step "GitHub release"

notes="$(awk -v v="$next" '
	$0 ~ "^## \\[" v "\\]" { found = 1; next }
	found && /^## \[/ { exit }
	found && !/^\[[^]]+\]: / { print }
' CHANGELOG.md)"

if command -v gh > /dev/null; then
	gh release create "$next" --title "$next" --notes "$notes"
else
	echo "  gh CLI not installed; create the release manually:"
	echo "  https://github.com/nhebling/dcraw-wasm/releases/new?tag=$next"
	echo "  (paste the $next section of CHANGELOG.md as notes)"
fi

echo
echo "✔ Released $next"
