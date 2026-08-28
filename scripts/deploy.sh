#!/bin/bash
# Run on the host (~/review-website-nextjs) to deploy whatever's currently on
# origin/main — collapses the manual sequence (git pull, docker compose
# build, docker compose up -d) into one command. Not triggered automatically
# by anything; you run this yourself when you want to deploy.
#
# git reset --hard rather than git pull: always converges to exactly what's
# on GitHub, never conflicts. That means any uncommitted/scp'd changes in
# this checkout get wiped — commit and push before running this.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch origin main
git reset --hard origin/main

sudo docker compose build app maintenance
sudo docker compose up -d db app cloudflared
