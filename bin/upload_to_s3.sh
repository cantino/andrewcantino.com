#!/usr/bin/env sh

s3cmd sync --cf-invalidate --delete-removed --rexclude=^.git\|^bin . s3://andrewcantino.com
