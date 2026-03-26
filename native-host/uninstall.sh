#!/bin/bash

# Claude Lens uninstaller
# - Removes Native Messaging host registration from Chrome

HOST_NAME="com.claude_lens.host"

REMOVED=0

for dir in \
  "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" \
  "$HOME/Library/Application Support/Chromium/NativeMessagingHosts" \
  "$HOME/.config/google-chrome/NativeMessagingHosts" \
  "$HOME/.config/chromium/NativeMessagingHosts"
do
  if [ -f "$dir/$HOST_NAME.json" ]; then
    rm "$dir/$HOST_NAME.json"
    echo "[native-host] Removed: $dir/$HOST_NAME.json"
    REMOVED=1
  fi
done

if [ $REMOVED -eq 0 ]; then
  echo "[native-host] Nothing to remove (not installed)"
fi

# Remove LaunchAgent
PLIST_FILE="$HOME/Library/LaunchAgents/com.claude-lens.server.plist"
if [ -f "$PLIST_FILE" ]; then
  launchctl unload "$PLIST_FILE" 2>/dev/null || true
  rm "$PLIST_FILE"
  echo "[launchagent] Removed: $PLIST_FILE"
fi

# Remove from global Claude Code settings
CLAUDE_SETTINGS="$HOME/.claude/settings.json"
if [ -f "$CLAUDE_SETTINGS" ]; then
  node - "$CLAUDE_SETTINGS" << 'JSEOF'
const fs = require('fs')
const [,, settingsPath] = process.argv
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
if (settings.mcpServers) delete settings.mcpServers['claude-lens']
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
JSEOF
  echo "[mcp] Removed from: $CLAUDE_SETTINGS"
fi

# Kill running server
pkill -f "claude-lens/server/index.js" 2>/dev/null || true

echo ""
echo "Done."
