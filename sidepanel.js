const WS_URL = 'ws://localhost:19280/terminal'
const RECONNECT_INTERVAL = 3000

const statusEl = document.getElementById('status')
const terminalEl = document.getElementById('terminal')
const pickBtn = document.getElementById('pickBtn')
const toolbarLabel = document.getElementById('toolbarLabel')

let ws = null
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

  try {
    const webglAddon = new WebglAddon.WebglAddon()
    webglAddon.onContextLoss(() => webglAddon.dispose())
    term.loadAddon(webglAddon)
  } catch {}

  term.open(terminalEl)
  fitAddon.fit()

  term.onData((data) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data)
    }
  })

  term.onResize(({ cols, rows }) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })

  new ResizeObserver(() => fitAddon.fit()).observe(terminalEl)
}

function connect() {
  showStatus('Connecting to server...')
  ws = new WebSocket(WS_URL)

  ws.onopen = () => {
    hideStatus()
    term.focus()
    ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
  }

  ws.onmessage = (event) => term.write(event.data)

  ws.onclose = () => {
    showStatus('Disconnected. Reconnecting...', false)
    setTimeout(connect, RECONNECT_INTERVAL)
  }

  ws.onerror = () => {
    showStatus('Cannot connect.\nnpm start --prefix ~/Desktop/dev/page-lens/server', true)
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error('No active tab')
    chrome.tabs.sendMessage(tab.id, { action: 'startInspector' })
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

// Listen for picked element from content script
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'elementPicked') {
    stopPicking()
    injectElementData(message.data)
  }

  if (message.action === 'inspectorCancelled') {
    stopPicking()
  }
})

function injectElementData(data) {
  // Format as a concise context block
  const lines = []
  lines.push(`I'm looking at this element on ${data.pageUrl}:`)
  lines.push('')
  lines.push(`Selector: ${data.selector}`)
  lines.push(`Size: ${data.size.w}×${data.size.h}px`)

  const styleEntries = Object.entries(data.styles || {})
  if (styleEntries.length > 0) {
    lines.push(`Styles: ${styleEntries.map(([k, v]) => `${k}: ${v}`).join('; ')}`)
  }

  lines.push('')
  lines.push('```html')
  lines.push(data.html)
  lines.push('```')

  const text = lines.join('\n')

  // Send to server as inject message → writes to Claude PTY stdin
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'inject', text }))
  }

  term.focus()
}

// ── Boot ──

initTerminal()
connect()
