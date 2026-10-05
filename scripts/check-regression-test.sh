#!/usr/bin/env bash
# Prove that a change's regression test detects what the change fixes: the
# specs it adds or changes must pass with the change and fail without it.
#
# 1. Diff the working tree against the merge base with origin/<base-branch>.
#    Committed and uncommitted changes both count, so an agent can run this
#    before committing.
# 2. Run the changed specs as they are — they must pass.
# 3. Put the changed source files back to the merge base, keep the specs, and
#    run them again — at least one test must fail.
# 4. Restore the source files (also on error or Ctrl-C).
#
# Source files are non-spec code files of a workspace member, except
# package.json (a dependency change needs a reinstall). Test helpers under
# test/ or __tests__/ count as specs' side and are never reverted.
#
# Usage:
#   bash scripts/check-regression-test.sh [base-branch]   # default: main
#
# Environment:
#   BASE=<commit>    compare against this commit instead of the merge base
#   ALLOW_NO_TEST=1  source changes without a changed spec are accepted
#                    (CI sets it from the `no-regression-test` label)
#   DEBUG=1          keep the Vitest reports and logs
#
# Exit status: 0 when proven or nothing to check, 1 otherwise. A report goes
# to $GITHUB_STEP_SUMMARY when set, otherwise to stdout.
set -euo pipefail

cd "$(dirname "$0")/.."

base_branch=${1:-main}
if [[ -z "${BASE:-}" ]]; then
    git fetch --quiet origin "$base_branch"
    BASE=$(git merge-base "origin/$base_branch" HEAD)
fi

summary=${GITHUB_STEP_SUMMARY:-/dev/stdout}
report() { printf '%s\n' "$@" >> "$summary"; }
fail() { report "" "❌ $1"; exit 1; }

tmp=$(mktemp -d)

# Nearest directory above $1 holding a package.json, excluding the repo root.
member_of() {
    local dir
    dir=$(dirname "$1")
    while [[ "$dir" != . ]]; do
        if [[ -f "$dir/package.json" ]]; then
            echo "$dir"
            return
        fi
        dir=$(dirname "$dir")
    done
}

# --- 1. Classify changed files ------------------------------------------------
specs=()
sources=()     # "<status> <path>", status A, M or D
while read -r status path; do
    [[ -n "$(member_of "$path")" ]] || continue
    case "$path" in
        *.spec.ts | *.spec.tsx | *.spec.js | *.spec.jsx)
            if [[ "$status" != D ]]; then specs+=("$path"); fi
            ;;
        */test/* | */__tests__/* | */__snapshots__/* | */package.json) ;;
        *.ts | *.tsx | *.js | *.jsx | *.mts | *.cts | *.mjs | *.cjs | *.json)
            sources+=("$status $path")
            ;;
    esac
done < <(
    git diff --no-renames --name-status "$BASE"
    git ls-files --others --exclude-standard | sed 's/^/A /'
)

is_feature=false
while read -r changeset; do
    if grep -qE ':[[:space:]]*minor' "$changeset" 2>/dev/null; then is_feature=true; fi
done < <(
    git diff --name-only "$BASE" -- '.changeset/*.md'
    git ls-files --others --exclude-standard -- '.changeset/*.md'
)

report "### Regression test" ""
if (( ${#sources[@]} == 0 )); then
    report "⏭️ Nothing to check: no source changes."
    exit 0
fi
if (( ${#specs[@]} == 0 )); then
    if [[ "${ALLOW_NO_TEST:-0}" == 1 ]]; then
        report "⏭️ Source changed without a spec; accepted by \`no-regression-test\`."
        exit 0
    fi
    fail "Source changed, but no spec was added or changed. Add a regression test, or label the PR \`no-regression-test\` if none is needed."
fi

spec_members=()
while read -r member; do spec_members+=("$member"); done < <(
    for spec in "${specs[@]}"; do member_of "$spec"; done | sort -u
)
# Members are linked through dist/, so a reverted member that isn't also a
# spec member has to be rebuilt for the specs to see the revert.
rebuild=()
while read -r member; do
    if [[ " ${spec_members[*]} " != *" $member "* ]]; then rebuild+=("$member"); fi
done < <(for entry in "${sources[@]}"; do member_of "${entry#* }"; done | sort -u)

# Runs the changed specs per member; writes $tmp/<label>-<n>.json and .log.
run_specs() {
    local label=$1 n=0 member spec files
    for member in "${spec_members[@]}"; do
        files=()
        for spec in "${specs[@]}"; do
            if [[ "$(member_of "$spec")" == "$member" ]]; then files+=("${spec#"$member"/}"); fi
        done
        (cd "$member" && pnpm exec vitest run "${files[@]}" --coverage.enabled=false \
            --reporter=json --outputFile="$tmp/$label-$n.json") >"$tmp/$label-$n.log" 2>&1 || true
        if [[ ! -s "$tmp/$label-$n.json" ]]; then
            report "" "Vitest produced no report for \`$member\`:" '```' "$(tail -n 30 "$tmp/$label-$n.log")" '```'
            fail "Couldn't run the specs."
        fi
        n=$((n + 1))
    done
}
# Failed assertions, and spec files that failed without a failed assertion
# (they didn't load — e.g. an import that doesn't exist without the change).
failed_tests() { jq -r '.testResults[].assertionResults[] | select(.status == "failed") | .fullName' "$tmp"/"$1"-*.json; }
failed_loads() {
    jq -r '.testResults[] | select(.status == "failed" and
        ([.assertionResults[] | select(.status == "failed")] | length) == 0) | .name' "$tmp"/"$1"-*.json
}
bullets() { sed 's/^/- /'; }

report "Specs: $(printf '`%s` ' "${specs[@]}")" ""

# --- 2. With the change -------------------------------------------------------
run_specs with
if [[ -n "$(failed_tests with)$(failed_loads with)" ]]; then
    report "Failing with the change:" "$( (failed_tests with; failed_loads with) | bullets)"
    fail "The changed specs fail with the change itself."
fi

# --- 3. Without the change ----------------------------------------------------
restore() {
    local entry path
    for entry in "${sources[@]}"; do
        path=${entry#* }
        if [[ -e "$tmp/keep/$path" ]]; then
            mkdir -p "$(dirname "$path")"
            cp "$tmp/keep/$path" "$path"
        else
            rm -f "$path"
        fi
    done
}
rebuild_members() {
    local member
    if (( ${#rebuild[@]} > 0 )); then
        for member in "${rebuild[@]}"; do pnpm --filter "./$member" build >/dev/null; done
    fi
}
trap 'restore; if [[ -n "${DEBUG:-}" ]]; then echo "Reports kept in $tmp" >&2; else rm -rf "$tmp"; fi' EXIT

for entry in "${sources[@]}"; do
    path=${entry#* }
    if [[ -e "$path" ]]; then
        mkdir -p "$tmp/keep/$(dirname "$path")"
        cp "$path" "$tmp/keep/$path"
    fi
    if [[ "${entry%% *}" == A ]]; then
        rm -f "$path"
    else
        mkdir -p "$(dirname "$path")"
        git show "$BASE:$path" > "$path"
    fi
done
rebuild_members

run_specs without
tests=$(failed_tests without)
loads=$(failed_loads without)

restore
rebuild_members

# --- 4. Verdict ---------------------------------------------------------------
if [[ -n "$tests" ]]; then
    report "✅ The regression test detects the change. Failing without it:" "$(bullets <<< "$tests")"
    exit 0
fi
if [[ -n "$loads" ]]; then
    report "Without the change these specs don't load:" "$(bullets <<< "$loads")"
    if [[ "$is_feature" == true ]]; then
        report "" "✅ Expected for a feature (minor changeset): its tests use code that didn't exist before."
        exit 0
    fi
    fail "Inconclusive: the specs fail only because they don't load without the change. Add a test that exercises the bug through code that exists without the fix."
fi
fail "The changed specs pass without the change, so they don't detect what it fixes."
