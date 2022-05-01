#!/bin/sh
FILES=$(git diff --cached --name-only --diff-filter=ACMR | sed 's| |\\ |g')
[ -z "$FILES" ] && exit 0

# Prettify all selected files
echo "$FILES" | xargs ./node_modules/.bin/prettier --ignore-unknown --write

# Run eslint to verify that things are all correct
echo "$FILES" | xargs ./node_modules/.bin/eslint --fix

# Add back the modified/prettified files to staging
echo "$FILES" | xargs git add

exit 0