#!/usr/bin/env sh

s3cmd sync --no-check-md5 --cf-invalidate -M --no-mime-magic --delete-removed --rexclude=^.git\|^bin . s3://andrewcantino.com
