const TERMINAL_URL = 'ws://localhost:19280/terminal';
const CONTROL_URL = 'ws://localhost:19280/control';
const RECONNECT_INTERVAL = 3000;

// ── DOM Elements ──

const statusEl = document.getElementById('status');
const terminalEl = document.getElementById('terminal');
const pickBtn = document.getElementById('pickBtn');
const toolbarLabel = document.getElementById('toolbarLabel');

// ── Assemble ──

const statusView = new StatusView(statusEl, terminalEl);
const terminalView = new TerminalView(terminalEl);
const terminalService = new TerminalService(TERMINAL_URL, RECONNECT_INTERVAL);
const controlService = new ControlService(CONTROL_URL, RECONNECT_INTERVAL);
const pickerFeature = new PickerFeature(pickBtn, toolbarLabel);

// ── Boot ──

terminalView.init();
statusView.setFitAddon(terminalView.fitAddon);
pickerFeature.setDependencies(terminalService, terminalView);
terminalService.connect(terminalView, statusView);
controlService.connect();
