#!/usr/bin/env bash
set -e # stop at any error

# trick to hide GitHub token in logs
git config credential.helper "store --file=.git/credentials"
echo "https://$GH_TOKEN:@github.com" > .git/credentials

# push latest commit in current branch to `gh-pages`
git push "https://github.com/sainaen/gp-helper.git" HEAD:gh-pages
