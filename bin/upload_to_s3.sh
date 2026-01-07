#!/usr/bin/env sh

s3cmd sync --no-check-md5 --cf-invalidate -M --no-mime-magic --delete-removed --rexclude=^.git\|^.idea\|.DS_Store\|^bin\|^mac/sympatric-speciation . s3://andrewcantino.com
