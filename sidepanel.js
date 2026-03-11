const WS_URL = 'ws://localhost:19280'
const RECONNECT_INTERVAL = 3000

const statusEl = document.getElementById('status')
const terminalEl = document.getElementById('terminal')

let ws = null
let term = null
let fitAddon = null

function initTerminal() {
  term = new Terminal({
    fontSize: 13,
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
    theme: {
      background: '#0a0a0c',
      foreground: '#d4d4d8',
      cursor: '#a78bfa',
      cursorAccent: '#0a0a0c',
      selectionBackground: '#27272a80',
      black: '#18181b',
      red: '#f87171',
      green: '#34d399',
      yellow: '#fbbf24',
      blue: '#60a5fa',
      magenta: '#a78bfa',
      cyan: '#22d3ee',
      white: '#d4d4d8',
      brightBlack: '#52525b',
      brightRed: '#fca5a5',
      brightGreen: '#6ee7b7',
      brightYellow: '#fde68a',
      brightBlue: '#93c5fd',
      brightMagenta: '#c4b5fd',
      brightCyan: '#67e8f9',
      brightWhite: '#f4f4f5',
    },
    cursorBlink: true,
    cursorStyle: 'bar',
    scrollback: 5000,
    allowProposedApi: true,
  })

  fitAddon = new FitAddon.FitAddon()
  term.loadAddon(fitAddon)

  // Try WebGL renderer for performance
  try {
    const webglAddon = new WebglAddon.WebglAddon()
    webglAddon.onContextLoss(() => webglAddon.dispose())
    term.loadAddon(webglAddon)
  } catch {
    // fallback to canvas renderer
  }

  term.open(terminalEl)
  fitAddon.fit()

  // Send keystrokes to server
  term.onData((data) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })

  // Handle resize
  term.onResize(({ cols, rows }) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })

  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit()
  })
  resizeObserver.observe(terminalEl)
}

function connect() {
  showStatus('Connecting to server...')

  ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    hideStatus()
    term.focus()

    // Send initial size
    ws.send(JSON.stringify({
      type: 'resize',
      cols: term.cols,
      rows: term.rows,
    }))
  }

  ws.onmessage = (event) => {
    term.write(event.data)
  }

  ws.onclose = () => {
    showStatus('Disconnected. Reconnecting...', false)
    setTimeout(connect, RECONNECT_INTERVAL)
  }

  ws.onerror = () => {
    showStatus('Cannot connect. Is the server running?\nnpm start --prefix server', true)
  }
}

function showStatus(text, isError = false) {
  statusEl.textContent = text
  statusEl.classList.add('visible')
  statusEl.classList.toggle('error', isError)
  terminalEl.style.display = 'none'
}

function hideStatus() {
  statusEl.classList.remove('visible')
  terminalEl.style.display = ''
  fitAddon?.fit()
}

// Boot
initTerminal()
connect()
