# Claude Lens

> Run Claude Code CLI in your Chrome side panel — with full access to the current tab's DOM via MCP.

**[한국어](README.ko.md)**

---

![Architecture](docs/images/architecture.svg)

---

## Demo

<!-- Add demo screenshots/video here -->
![Demo 1](docs/images/1.png)
![Demo 2](docs/images/2.png)

<!-- Demo video -->
<!-- ![Demo Video](docs/images/demo.gif) -->
<!-- <video src="docs/images/demo.mp4" controls width="100%"></video> -->

---

## Prerequisites

- **macOS** (LaunchAgent support required)
- **Node.js** 18+
- **Claude Code CLI** — `npm install -g @anthropic-ai/claude-code`
- **Chrome** or any Chromium-based browser (Arc, Brave, Edge, etc.)

---

## Installation

### 1. Clone & Load Extension

```bash
git clone https://github.com/KooYS/claude-lens.git
cd claude-lens
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer Mode** (top-right toggle)
3. Click **Load unpacked** → select the project root folder
4. Note your **Extension ID** (fixed via `manifest.json` key field — stays the same across reloads)

### 2. Run the Installer

```bash
cd native-host
./install.sh
```

This script automatically:
- Installs server npm dependencies
- Registers the **Native Messaging Host** (allows Chrome to launch the server)
- Creates a **LaunchAgent** that auto-starts the server on login
- Registers the **MCP server** in `~/.claude/settings.json`

### 3. Restart Chrome

Native Messaging requires a **full Chrome restart** after installation.

---

## Usage

### Connecting

1. Click the **Claude Lens icon** in the toolbar → side panel opens
2. Click the **gear icon** to open Settings and configure:
   | Setting | Description |
   |---------|-------------|
   | Server Port | Local server port (default: `19280`) |
   | Claude CLI | Path to `claude` binary (auto-detected via `which claude`) |
   | Working Directory | Directory where Claude sessions start |
   | Font Size / Theme | Terminal appearance |
   | Skip Permissions | Adds `--dangerously-skip-permissions` flag |
3. Click **Connect** — the server starts automatically and Claude launches
4. To change settings: click the **gear icon** → update → reconnect

### MCP Tools

Inside a Claude Code session, the following tools are available to inspect the current Chrome tab:

| Tool | Description |
|------|-------------|
| `get_current_page` | URL and title of the active tab |
| `get_page_summary` | DOM structure analysis |
| `get_page_tree(depth)` | Component tree (default depth: 4) |
| `get_visible_text(selector)` | Read text from any element |
| `get_input_values` | All form input values |
| `get_element_info(selector)` | Element styles and dimensions |
| `get_element_html(selector)` | Raw HTML of an element |
| `get_layout_info` | Flex/Grid layout detection |
| `run_js_on_page(code)` | Execute JavaScript on the current page |
| `start_network_capture` | Start capturing network requests |
| `get_network_requests(type?, urlPattern?, statusCode?, limit?)` | Query captured requests |
| `get_network_response_body(requestId)` | Get response body |
| `stop_network_capture` | Stop capturing and detach debugger |

---

## Uninstall

```bash
cd native-host
./uninstall.sh
```

This removes the Native Messaging registration, LaunchAgent, MCP entry from `~/.claude/settings.json`, and kills any running server process.

---

## Notes & Troubleshooting

> If you run into an issue not covered here, feel free to reach out at **0seo4207@gmail.com**.

**Server doesn't start on Connect**
- Make sure `./install.sh` was run and Chrome was fully restarted afterward.
- Check logs: `tail -f /tmp/claude-lens-server.log`
- Try starting manually: `cd server && node index.js`

**`claude` binary not found**
- Run `which claude` in your terminal and paste the path into Settings → Claude CLI.
- Or re-run `./install.sh` after installing Claude Code CLI.

**Extension ID mismatch**
- The Extension ID is fixed via the `key` field in `manifest.json`. If you're using a fork without the key, pass your ID to the installer: `./install.sh <your-extension-id>`

**Port conflict**
- Change the port in Settings. Make sure to restart the server (`launchctl unload/load`) and reconnect from the panel.

**Network capture doesn't work**
- The Chrome debugger attaches to the active tab. Only one debugger can be attached at a time — close DevTools if it's open on the same tab.
