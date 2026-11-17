#!/usr/bin/env sh
set -e

BUCKET=andrewcantino.com

aws s3 sync . "s3://$BUCKET" \
  --delete \
  --exclude ".git*" \
  --exclude ".idea*" \
  --exclude "*.DS_Store" \
  --exclude "bin/*"

DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Aliases.Items || \`[]\`, '$BUCKET')].Id | [0]" \
  --output text)

aws cloudfront create-invalidation --distribution-id "$DIST_ID" --paths "/*"
