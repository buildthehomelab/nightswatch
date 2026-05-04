#!/bin/sh
# Auto-commit hook for Claude Code. Picks conventional commit prefix from changed file paths.
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" = "main" ] && echo "Auto-commit skipped on main" && exit 0
git add -A
git diff --cached --quiet && exit 0

FILES=$(git diff --cached --name-only)

# Priority order: last match wins, so higher-priority rules go later
PREFIX=chore
echo "$FILES" | grep -qE '^src/'                                     && PREFIX=feat
echo "$FILES" | grep -qE '^(docs/|README|CONTRIBUTING|CHANGELOG)'    && PREFIX=docs
echo "$FILES" | grep -qE '^\.github/'                                && PREFIX=ci
echo "$FILES" | grep -qE '\.(test|spec)\.(js|jsx|ts|tsx)$'           && PREFIX=test

NAMES=$(echo "$FILES" | head -5 | tr '\n' ' ' | xargs)
git commit -m "$PREFIX: $NAMES"
