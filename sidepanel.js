const TERMINAL_URL = 'ws://localhost:19280/terminal'
const CONTROL_URL = 'ws://localhost:19280/control'
const RECONNECT_INTERVAL = 3000

const statusEl = document.getElementById('status')
const terminalEl = document.getElementById('terminal')
const pickBtn = document.getElementById('pickBtn')
const toolbarLabel = document.getElementById('toolbarLabel')

let ws = null
let controlWs = null
let term = null
let fitAddon = null
let picking = false

// ── Terminal ──

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
  term.open(terminalEl)
  fitAddon.fit()

  term.onData((data) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(data)
  })

  term.onResize(({ cols, rows }) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })

  new ResizeObserver(() => fitAddon.fit()).observe(terminalEl)
}

// ── Terminal WebSocket ──

function connectTerminal() {
  showStatus('Connecting to server...')
  ws = new WebSocket(TERMINAL_URL)

  ws.onopen = () => {
    hideStatus()
    term.focus()
    ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
  }

  ws.onmessage = (event) => term.write(event.data)

  ws.onclose = () => {
    showStatus('Disconnected. Reconnecting...', false)
    setTimeout(connectTerminal, RECONNECT_INTERVAL)
  }

  ws.onerror = () => {
    showStatus('Cannot connect.\nnpm start --prefix ~/Desktop/dev/page-lens/server', true)
  }
}

// ── Control WebSocket (for MCP API requests) ──

function connectControl() {
  controlWs = new WebSocket(CONTROL_URL)

  controlWs.onopen = () => console.log('[page-lens] control connected')

  controlWs.onmessage = async (event) => {
    let msg
    try { msg = JSON.parse(event.data) } catch { return }
    if (!msg.id || !msg.action) return

    try {
      const result = await queryContentScript(msg.action, msg)
      controlWs.send(JSON.stringify({ id: msg.id, result }))
    } catch (err) {
      controlWs.send(JSON.stringify({ id: msg.id, error: err.message }))
    }
  }

  controlWs.onclose = () => {
    console.log('[page-lens] control disconnected, reconnecting...')
    setTimeout(connectControl, RECONNECT_INTERVAL)
  }

  controlWs.onerror = () => {} // onclose handles reconnect
}

async function queryContentScript(action, params) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab?.id) throw new Error('No active tab')

  return new Promise((resolve, reject) => {
    // Ask background to inject + query
    chrome.runtime.sendMessage(
      { action: 'queryTab', tabId: tab.id, query: { action, ...params } },
      (response) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
        else if (response?.error) reject(new Error(response.error))
        else resolve(response)
      },
    )
  })
}

// ── Status ──

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

// ── Element Picker ──

pickBtn.addEventListener('click', async () => {
  if (picking) {
    stopPicking()
    return
  }

  picking = true
  pickBtn.classList.add('active')
  toolbarLabel.textContent = 'Pick an element...'

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    if (!tab?.id) throw new Error('No active tab')

    chrome.runtime.sendMessage(
      { action: 'startInspector', tabId: tab.id },
      (response) => {
        if (chrome.runtime.lastError || response?.error) {
          stopPicking()
          toolbarLabel.textContent = `Error: ${chrome.runtime.lastError?.message || response.error}`
        }
      },
    )
  } catch (err) {
    stopPicking()
    toolbarLabel.textContent = `Error: ${err.message}`
  }
})

function stopPicking() {
  picking = false
  pickBtn.classList.remove('active')
  toolbarLabel.textContent = 'Page Lens'
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.pickedElement && picking) {
    stopPicking()
    const data = changes.pickedElement.newValue
    if (data) injectElementData(data)
  }
})

function injectElementData(data) {
  const text = `Here is the element structure from ${data.pageUrl}:\n\n${data.tree}\n`
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'inject', text }))
  }
  term.focus()
}

// ── Boot ──

initTerminal()
connectTerminal()
connectControl()
