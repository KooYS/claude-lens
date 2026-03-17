#!/bin/bash

# Chrome launches native messaging hosts with a minimal PATH.
# This wrapper sources the user's shell profile to find node.

if [ -f "$HOME/.zshrc" ]; then
  source "$HOME/.zshrc" 2>/dev/null
elif [ -f "$HOME/.bashrc" ]; then
  source "$HOME/.bashrc" 2>/dev/null
elif [ -f "$HOME/.bash_profile" ]; then
  source "$HOME/.bash_profile" 2>/dev/null
fi

# nvm support
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  source "$HOME/.nvm/nvm.sh" 2>/dev/null
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/host.js" "$@"
