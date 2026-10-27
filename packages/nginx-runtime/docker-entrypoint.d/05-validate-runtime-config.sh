#!/bin/sh
# Generic guard: the runtime config must exist and be parseable JSON.
#
# This is NOT the real gate. Schema validation runs in the validating
# initContainer the chart generates from `templates.<name>.validate`, against
# the app's own Zod schema. This hook exists so a bare `docker run` (no
# initContainer) fails loudly instead of serving a blank page, and as defence
# in depth if an app is ever deployed without opting in.
#
# Keep this file schema-free. The moment it grows per-app knowledge, the
# duplication the design avoids is back.
#
# Runs from the stock nginx entrypoint (/docker-entrypoint.d, sorted order,
# `set -e`), so a non-zero exit aborts before nginx binds. Numbered 05 so it
# runs before 20-envsubst-on-templates.sh and any *.envsh that reads the config.
#
# NEVER print config values — homelab-dashboard-ui's config.json holds a secret.
set -eu

CONFIG_PATH="${RUNTIME_CONFIG_PATH:-/usr/share/nginx/html/config.json}"

fatal() { echo "[nginx-runtime] FATAL: $*" >&2; exit 1; }

[ -f "$CONFIG_PATH" ] \
    || fatal "$CONFIG_PATH not found — the chart mounts it from templates.config."

# jq is more lenient than JSON.parse, which the browser loader and the validating
# initContainer use. Narrow it down to what JSON.parse accepts:
#  1. exactly one top-level value (jq reads `{}{}` as two). No `-e`: it would
#     also reject a legitimate top-level `null` or `false`. jq 1.8 rejects an
#     unpaired \uD800-\uDFFF escape that JSON.parse accepts, so each one becomes
#     U+FFFD in this parse copy only (an escaped backslash and a valid high+low
#     pair are left alone).
#  2. no NaN/Infinity literals and no leading-zero numbers. With string contents
#     blanked out, only true/false/null may remain as bare words.
#  3. no number JSON.parse rejects: a `.` without a digit on both sides (.5, 1.)
#     or a `+` that is not an exponent sign (+1).
# stderr is discarded so config values never reach the log.
jq -R -s -r '
    gsub("(?<keep>\\\\\\\\|\\\\u[dD][89abAB][0-9a-fA-F]{2}\\\\u[dD][c-fC-F][0-9a-fA-F]{2})|\\\\u[dD][89a-fA-F][0-9a-fA-F]{2}";
         if .keep == null then "\\ufffd" else .keep end)
' "$CONFIG_PATH" 2>/dev/null | jq -n -e '[inputs] | length == 1' >/dev/null 2>&1 \
    || fatal "$CONFIG_PATH is not valid JSON."

jq -R -s -e '
    gsub("\"(\\\\.|[^\"\\\\])*\""; "\"\"")
    | gsub("\\b(true|false|null)\\b"; "")
    | test("[A-DF-Za-df-z]|(^|[\\s:,\\[])-?0[0-9]|(^|[^0-9])\\.|\\.([^0-9]|$)|(^|[^eE])\\+") | not
' "$CONFIG_PATH" >/dev/null 2>&1 \
    || fatal "$CONFIG_PATH is not valid JSON."

echo "[nginx-runtime] runtime config present and parseable ($CONFIG_PATH)"
