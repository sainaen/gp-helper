#!/usr/bin/env bash
set -e # stop at any error

repoUrl="https://github.com/sainaen/gp-helper.git"
repoFolder="gp-helper-site"
buildFolder="build"

git clone --branch gh-pages $repoUrl $repoFolder
rm -rf $repoFolder/*
cp -r $buildFolder/* $repoFolder/

cd $repoFolder

# trick to hide GitHub token in logs
git config credential.helper "store --file=.git/credentials"
echo "https://$GH_TOKEN:@github.com" > .git/credentials

# commit changes
git add --all
git commit --author="Travis-CI bot <bot@travis-ci.com>" --message="Update the site"

# push latest commit in current branch to `gh-pages`
git push $repoUrl HEAD:gh-pages
