#!/bin/sh
set -e

HOOK=.git/hooks/pre-commit

cp scripts/pre-commit.sh "$HOOK"
chmod +x "$HOOK"
echo "pre-commit hook installed"
