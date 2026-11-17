#!/usr/bin/env sh
set -e

# Deploy credentials live in 1Password, not ~/.aws/credentials.
# Assigned separately from export so a failed `op read` stops the script.
OP_ITEM="op://Private/aws-my-website"
AWS_ACCESS_KEY_ID=$(op read "$OP_ITEM/access-key-id")
AWS_SECRET_ACCESS_KEY=$(op read "$OP_ITEM/secret-access-key")
export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION=us-east-1
unset AWS_PROFILE AWS_SESSION_TOKEN

aws s3 sync . s3://andrewcantino.com \
  --delete \
  --exclude ".git*" \
  --exclude ".idea*" \
  --exclude "*.DS_Store" \
  --exclude "bin/*"

aws cloudfront create-invalidation --distribution-id E1JGJNT6C6SW61 --paths "/*"
