#!/usr/bin/env sh
set -e

aws s3 sync . s3://andrewcantino.com \
  --delete \
  --exclude ".git*" \
  --exclude ".idea*" \
  --exclude "*.DS_Store" \
  --exclude "bin/*"

aws cloudfront create-invalidation --distribution-id E1JGJNT6C6SW61 --paths "/*"
