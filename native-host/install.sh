#!/bin/bash

# Claude Lens installer
# - Registers Native Messaging host for Chrome
# - Registers MCP server globally in ~/.claude/settings.json
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

# ── 0. Server dependencies ──

echo "[server] Installing npm dependencies..."
npm install --prefix "$PROJECT_DIR/server" --silent

# node-pty's spawn-helper loses execute permission on npm install
chmod +x "$PROJECT_DIR/server/node_modules/node-pty/prebuilds/darwin-x64/spawn-helper" 2>/dev/null || true
chmod +x "$PROJECT_DIR/server/node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper" 2>/dev/null || true

# ── 1. Resolve node path ──

NODE_BIN="$(which node 2>/dev/null)"
if [ -z "$NODE_BIN" ]; then
  # Try common locations
  for try in /usr/local/bin/node /opt/homebrew/bin/node /usr/bin/node; do
    if [ -x "$try" ]; then
      NODE_BIN="$try"
      break
    fi
  done
fi

if [ -z "$NODE_BIN" ]; then
  echo "Error: node not found. Install Node.js first."
  exit 1
fi

echo "[node] Found: $NODE_BIN"

# Write host.sh with resolved node path (Chrome uses minimal PATH)
cat > "$HOST_PATH" << EOF
#!/bin/bash
exec "$NODE_BIN" "$SCRIPT_DIR/host.js" "\$@"
EOF
chmod +x "$HOST_PATH"

# ── 3. Native Messaging Host ──

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

# ── 4. LaunchAgent (auto-start server on login) ──

PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$PLIST_DIR/com.claude-lens.server.plist"

# Detect Claude CLI binary path at install time
CLAUDE_BIN="$(which claude 2>/dev/null)"
if [ -z "$CLAUDE_BIN" ]; then
  for try in /usr/local/bin/claude /opt/homebrew/bin/claude "$HOME/.local/bin/claude"; do
    if [ -x "$try" ]; then
      CLAUDE_BIN="$try"
      break
    fi
  done
fi

if [ -n "$CLAUDE_BIN" ]; then
  echo "[claude] Found: $CLAUDE_BIN"
  CLAUDE_BIN_ENTRY="
    <key>CLAUDE_BIN</key>
    <string>$CLAUDE_BIN</string>"
else
  echo "[claude] Not found — set manually in the extension settings"
  CLAUDE_BIN_ENTRY=""
fi

mkdir -p "$PLIST_DIR"

cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.claude-lens.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$PROJECT_DIR/server/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key>
    <string>19280</string>$CLAUDE_BIN_ENTRY
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/claude-lens-server.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/claude-lens-server.log</string>
</dict>
</plist>
EOF

# Load immediately (no need to reboot)
launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl load "$PLIST_FILE"

echo "[launchagent] Installed and started: $PLIST_FILE"

# ── 5. Global Claude Code MCP (works in any working directory) ──

CLAUDE_SETTINGS="$HOME/.claude/settings.json"

if [ -f "$CLAUDE_SETTINGS" ]; then
  # Inject mcpServers into existing settings.json using node
  node - "$CLAUDE_SETTINGS" "$PROJECT_DIR/server/mcp-server.js" << 'JSEOF'
const fs = require('fs')
const [,, settingsPath, mcpServerPath] = process.argv
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
settings.mcpServers = settings.mcpServers || {}
settings.mcpServers['claude-lens'] = { command: process.execPath, args: [mcpServerPath] }
fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n')
JSEOF
  echo "[mcp] Registered in: $CLAUDE_SETTINGS"
else
  mkdir -p "$HOME/.claude"
  cat > "$CLAUDE_SETTINGS" << EOF
{
  "mcpServers": {
    "claude-lens": {
      "command": "$NODE_BIN",
      "args": ["$PROJECT_DIR/server/mcp-server.js"]
    }
  }
}
EOF
  echo "[mcp] Created: $CLAUDE_SETTINGS"
fi

# ── Done ──

echo ""
echo "Project:   $PROJECT_DIR"
echo "Extension: $EXT_ID"
echo ""
echo "Done. Server is running. Open Chrome and click Connect."
