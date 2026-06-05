#!/usr/bin/env bash
# mac-text.sh -- convert classic-Mac (CR-only) text to Unix (LF) line endings.
#
# Old RealBASIC exports and saved data files use carriage-return line endings,
# so `wc -l` reports 0 and editors show one giant line. Convert before reading.
#
# Usage:
#   shared/rb-tools/mac-text.sh INPUT [OUTPUT]   # OUTPUT defaults to stdout
#   shared/rb-tools/mac-text.sh INPUT -          # explicit stdout
set -euo pipefail
in="${1:?usage: mac-text.sh INPUT [OUTPUT]}"
out="${2:--}"
if [ "$out" = "-" ]; then
  tr '\r' '\n' < "$in"
else
  tr '\r' '\n' < "$in" > "$out"
fi
