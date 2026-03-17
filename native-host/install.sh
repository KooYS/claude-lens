#!/bin/bash

# Claude Lens installer
# - Registers Native Messaging host for Chrome
# - Generates .mcp.json with correct absolute paths
#
# Usage: ./install.sh <chrome-extension-id>
# Find your extension ID at chrome://extensions (enable Developer Mode)

set -e

HOST_NAME="com.claude_lens.host"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HOST_PATH="$SCRIPT_DIR/host.sh"

# Fixed extension ID (from manifest.json "key" field)
DEFAULT_EXT_ID="jkpkmiabhmccppkllgiodohbhjppnhke"

EXT_ID="${1:-$DEFAULT_EXT_ID}"

# ── 1. Native Messaging Host ──

# Detect Chrome variant
if [ -d "$HOME/Library/Application Support/Google/Chrome" ]; then
  TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [ -d "$HOME/Library/Application Support/Chromium" ]; then
  TARGET_DIR="$HOME/Library/Application Support/Chromium/NativeMessagingHosts"
elif [ -d "$HOME/.config/google-chrome" ]; then
  TARGET_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
elif [ -d "$HOME/.config/chromium" ]; then
  TARGET_DIR="$HOME/.config/chromium/NativeMessagingHosts"
else
  echo "Error: Chrome installation not found"
  exit 1
fi

mkdir -p "$TARGET_DIR"

cat > "$TARGET_DIR/$HOST_NAME.json" << EOF
{
  "name": "$HOST_NAME",
  "description": "Claude Lens - starts the local server from the Chrome extension",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://$EXT_ID/"]
}
EOF

chmod +x "$HOST_PATH" "$SCRIPT_DIR/host.js"

echo "[native-host] Installed: $TARGET_DIR/$HOST_NAME.json"

# ── 2. .mcp.json ──

MCP_FILE="$PROJECT_DIR/.mcp.json"

cat > "$MCP_FILE" << EOF
{
  "mcpServers": {
    "claude-lens": {
      "command": "node",
      "args": ["$PROJECT_DIR/server/mcp-server.js"]
    }
  }
}
EOF

echo "[mcp] Generated: $MCP_FILE"

# ── Done ──

echo ""
echo "Project:   $PROJECT_DIR"
echo "Extension: $EXT_ID"
echo ""
echo "Done. Restart Chrome to activate native messaging."
