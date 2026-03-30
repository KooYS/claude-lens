const DEFAULT_PORT = 19280;
const RECONNECT_INTERVAL = 3000;

const STORAGE_KEYS = {
  folder: 'claudeLens_folder',
  port: 'claudeLens_port',
  fontSize: 'claudeLens_fontSize',
  theme: 'claudeLens_theme',
  skipPerm: 'claudeLens_skipPerm',
};

let serverPort = DEFAULT_PORT;

function getBaseUrl() { return `localhost:${serverPort}`; }
function getApiBase() { return `http://${getBaseUrl()}`; }

// ── DOM Elements ──

const statusEl = document.getElementById('status');
const terminalEl = document.getElementById('terminal');
const pickBtn = document.getElementById('pickBtn');
const toolbarLabel = document.getElementById('toolbarLabel');
const settingsBtn = document.getElementById('settingsBtn');
const setupEl = document.getElementById('setup');
const folderBtn = document.getElementById('folderBtn');
const connectBtn = document.getElementById('connectBtn');
const statusbar = document.getElementById('statusbar');
const portInput = document.getElementById('portInput');
const claudeBinBtn = document.getElementById('claudeBinBtn');
const claudeBinLabel = document.getElementById('claudeBinLabel');
const fontSizeInput = document.getElementById('fontSizeInput');
const themeSelect = document.getElementById('themeSelect');
const skipPermToggle = document.getElementById('skipPermToggle');
const copyInstallCmd = document.getElementById('copyInstallCmd');
const mcpServerPath = document.getElementById('mcpServerPath');
const installGuide = document.getElementById('installGuide');
const serverBadge = document.getElementById('serverBadge');
const installHint = document.getElementById('installHint');

// ── Assemble ──

const statusView = new StatusView(statusEl, terminalEl);
const terminalView = new TerminalView(terminalEl);
const terminalService = new TerminalService(RECONNECT_INTERVAL);
const controlService = new ControlService(RECONNECT_INTERVAL);
const pickerFeature = new PickerFeature(pickBtn, toolbarLabel);

// ── State ──

let connected = false;
let selectedFolder = '';
let picking = false;
let pickingClaudeBin = false;
let claudeBinPath = '';

// ── Claude CLI ──

function setClaudeBin(path) {
  claudeBinPath = path || '';
  claudeBinLabel.textContent = claudeBinPath
    ? claudeBinPath.split('/').pop() + ' — ' + claudeBinPath
    : 'Not found';
  claudeBinBtn.classList.toggle('selected', !!claudeBinPath);
}

async function fetchClaudeBin() {
  try {
    const res = await fetch(`${getApiBase()}/api/claude-bin`);
    const data = await res.json();
    setClaudeBin(data.path);
  } catch {
    claudeBinLabel.textContent = 'Auto-detect after connect';
  }
}

async function pickClaudeBin() {
  if (pickingClaudeBin) return;
  pickingClaudeBin = true;

  try {
    const defaultDir = claudeBinPath
      ? claudeBinPath.substring(0, claudeBinPath.lastIndexOf('/'))
      : '/usr/local/bin';
    const res = await fetch(`${getApiBase()}/api/pick-file?default=${encodeURIComponent(defaultDir)}`);
    const data = await res.json();
    if (data.path) {
      await fetch(`${getApiBase()}/api/claude-bin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: data.path }),
      });
      setClaudeBin(data.path);
    }
  } catch {
    statusbar.textContent = 'Server not running';
  } finally {
    pickingClaudeBin = false;
  }
}

// ── Folder Picker ──

function setFolder(path) {
  selectedFolder = path;
  folderBtn.querySelector('.setup__folder-btn-text').textContent = path
    ? path.split('/').pop()
    : 'Select folder...';
  folderBtn.classList.toggle('selected', !!path);
  statusbar.textContent = path || '';
}

async function openFolderPicker() {
  if (picking) return;
  picking = true;

  const defaultParam = selectedFolder
    ? `?default=${encodeURIComponent(selectedFolder)}`
    : '';
  try {
    const res = await fetch(`${getApiBase()}/api/pick-dir${defaultParam}`);
    const data = await res.json();
    if (data.path) {
      setFolder(data.path);
      await chrome.storage.local.set({ [STORAGE_KEYS.folder]: data.path });
    }
  } catch {
    statusbar.textContent = 'Server not running';
  } finally {
    picking = false;
  }
}

// ── Setup Screen ──

function showSetup() {
  setupEl.classList.add('visible');
  terminalEl.style.display = 'none';
  statusEl.classList.remove('visible');
  settingsBtn.classList.add('active');
}

function hideSetup() {
  setupEl.classList.remove('visible');
  terminalEl.style.display = '';
  settingsBtn.classList.remove('active');
}

function disconnect() {
  terminalService.disconnect();
  controlService.disconnect();
  terminalView.dispose();
  connected = false;
  connectBtn.disabled = false;
  connectBtn.textContent = 'Connect';
}

function buildWsUrl(path, folder, params = {}) {
  const url = new URL(`ws://${getBaseUrl()}${path}`);
  if (folder) url.searchParams.set('cwd', folder);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

const NATIVE_HOST = 'com.claude_lens.host';

function setServerBadge(state) {
  serverBadge.className = 'setup__card-badge';
  if (state === 'running') {
    serverBadge.textContent = 'Running';
    serverBadge.classList.add('running');
  } else if (state === 'starting') {
    serverBadge.textContent = 'Starting...';
  } else if (state === 'error') {
    serverBadge.textContent = 'Not installed';
    serverBadge.classList.add('error');
  } else {
    serverBadge.textContent = 'Not running';
  }
}

async function ensureServerRunning() {
  // Check if already running
  try {
    const res = await fetch(`${getApiBase()}/api/status`);
    if (res.ok) {
      setServerBadge('running');
      return true;
    }
  } catch {}

  // Start via native messaging
  try {
    setServerBadge('starting');
    statusbar.textContent = 'Starting server...';
    const response = await chrome.runtime.sendNativeMessage(NATIVE_HOST, {
      action: 'start',
      port: serverPort,
      claudeBin: claudeBinPath || undefined,
    });
    if (response.success) setServerBadge('running');
    return response.success;
  } catch (err) {
    console.error('[claude-lens] native messaging failed:', err);
    setServerBadge('error');
    statusbar.textContent = 'Auto-start not set up';
    installGuide.classList.add('error');
    installGuide.querySelector('.setup__cmd-box').classList.add('error');
    installHint.classList.add('error');
    installHint.textContent = 'Run the command above first, then reconnect';
    return false;
  }
}

async function handleConnect() {
  connectBtn.disabled = true;
  connectBtn.textContent = 'Connecting...';

  const serverReady = await ensureServerRunning();
  if (!serverReady) {
    connectBtn.disabled = false;
    connectBtn.textContent = 'Connect';
    return;
  }

  // Fetch claude binary info after server is confirmed running
  await fetchClaudeBin();

  hideSetup();
  connected = true;

  const fontSize = parseInt(fontSizeInput.value, 10) || 13;
  const theme = themeSelect.value || 'dark';
  terminalView.init({ fontSize, theme });
  statusView.setFitAddon(terminalView.fitAddon);
  pickerFeature.setDependencies(terminalService, terminalView);

  const skipPerm = skipPermToggle.checked;
  const terminalUrl = buildWsUrl('/terminal', selectedFolder, { skipPerm });
  const controlUrl = buildWsUrl('/control', selectedFolder);

  terminalService.connect(terminalUrl, terminalView, statusView);
  controlService.connect(controlUrl);
}

// ── Events ──

copyInstallCmd.addEventListener('click', () => {
  navigator.clipboard.writeText('./native-host/install.sh').then(() => {
    copyInstallCmd.style.color = '#e07a3a';
    setTimeout(() => { copyInstallCmd.style.color = ''; }, 1500);
  });
});

claudeBinBtn.addEventListener('click', pickClaudeBin);
folderBtn.addEventListener('click', openFolderPicker);

portInput.addEventListener('change', async () => {
  const port = parseInt(portInput.value, 10);
  if (port >= 1 && port <= 65535) {
    serverPort = port;
    await chrome.storage.local.set({ [STORAGE_KEYS.port]: port });
  } else {
    portInput.value = serverPort;
  }
});

fontSizeInput.addEventListener('change', async () => {
  const size = parseInt(fontSizeInput.value, 10);
  if (size >= 8 && size <= 24) {
    await chrome.storage.local.set({ [STORAGE_KEYS.fontSize]: size });
  } else {
    fontSizeInput.value = 13;
  }
});

themeSelect.addEventListener('change', async () => {
  await chrome.storage.local.set({ [STORAGE_KEYS.theme]: themeSelect.value });
});

skipPermToggle.addEventListener('change', async () => {
  await chrome.storage.local.set({ [STORAGE_KEYS.skipPerm]: skipPermToggle.checked });
});

settingsBtn.addEventListener('click', () => {
  if (setupEl.classList.contains('visible')) {
    if (connected) hideSetup();
  } else {
    if (connected) disconnect();
    showSetup();
    fetchClaudeBin();
  }
});

connectBtn.addEventListener('click', handleConnect);

// ── Boot ──

(async () => {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));

  if (stored[STORAGE_KEYS.port]) {
    serverPort = stored[STORAGE_KEYS.port];
    portInput.value = serverPort;
  }
  if (stored[STORAGE_KEYS.folder]) {
    setFolder(stored[STORAGE_KEYS.folder]);
  }
  if (stored[STORAGE_KEYS.fontSize]) {
    fontSizeInput.value = stored[STORAGE_KEYS.fontSize];
  }
  if (stored[STORAGE_KEYS.theme]) {
    themeSelect.value = stored[STORAGE_KEYS.theme];
  }
  if (stored[STORAGE_KEYS.skipPerm] !== undefined) {
    skipPermToggle.checked = stored[STORAGE_KEYS.skipPerm];
  }

  showSetup();
  fetchClaudeBin();
  fetch(`${getApiBase()}/api/mcp-path`)
    .then(r => r.json())
    .then(d => { if (d.path) mcpServerPath.textContent = d.path })
    .catch(() => {});

  // Check server status on boot for badge
  fetch(`${getApiBase()}/api/status`)
    .then(res => { if (res.ok) setServerBadge('running'); })
    .catch(() => {});

  // Notify background that side panel actually loaded
  chrome.runtime.sendMessage({ action: 'sidePanelReady' }).catch(() => {});
})();
