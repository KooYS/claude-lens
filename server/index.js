const http = require('http')
const { execSync } = require('child_process')
const { WebSocketServer, WebSocket } = require('ws')
const pty = require('node-pty')

const PORT = parseInt(process.env.PORT, 10) || 19280

const CLAUDE_BIN = (() => {
  try {
    return execSync('which claude', { encoding: 'utf8' }).trim()
  } catch {
    return '/Users/koo/.local/bin/claude'
  }
})()

// ── State ──

/** @type {WebSocket|null} */
let controlWs = null
let requestId = 0
const pendingRequests = new Map()

// ── HTTP Server ──

const httpServer = http.createServer((req, res) => {
  // CORS for MCP server
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/api/page') {
    queryExtension('analyzePage', { depth: 4 })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
    return
  }

  if (url.pathname === '/api/tree') {
    const depth = parseInt(url.searchParams.get('depth')) || 4
    queryExtension('analyzePage', { depth })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify({ tree: data.tree })) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
    return
  }

  if (url.pathname === '/api/element') {
    const selector = url.searchParams.get('selector')
    if (!selector) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'selector param required' })); return
    }
    queryExtension('getElementInfo', { selector })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
    return
  }

  if (url.pathname === '/api/layout') {
    queryExtension('detectLayouts', {})
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
    return
  }

  if (url.pathname === '/api/html') {
    const selector = url.searchParams.get('selector') || 'body'
    queryExtension('getOuterHTML', { selector })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
    return
  }

  if (url.pathname === '/api/eval') {
    const code = url.searchParams.get('code')
    if (!code) { res.writeHead(400); res.end(JSON.stringify({ error: 'code param required' })); return }
    queryExtension('evaluateJS', { code })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
    return
  }

  if (url.pathname === '/api/pageinfo') {
    queryExtension('getPageInfo', {})
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
    return
  }

  if (url.pathname === '/api/inputs') {
    queryExtension('getInputValues', {})
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
    return
  }

  if (url.pathname === '/api/text') {
    const selector = url.searchParams.get('selector') || 'body'
    const maxLength = parseInt(url.searchParams.get('maxLength')) || 2000
    queryExtension('getVisibleText', { selector, maxLength })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
    return
  }

  if (url.pathname === '/api/status') {
    res.writeHead(200)
    res.end(JSON.stringify({ connected: controlWs?.readyState === WebSocket.OPEN }))
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'not found' }))
})

// ── WebSocket Server ──

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/control') {
    handleControlConnection(ws)
  } else if (url.pathname === '/terminal') {
    handleTerminalConnection(ws)
  } else {
    ws.close(4000, 'Unknown path. Use /terminal or /control')
  }
})

// ── Control Connection (background.js) ──

function handleControlConnection(ws) {
  console.log('[claude-lens] extension control connected')
  controlWs = ws

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.id && pendingRequests.has(msg.id)) {
        const { resolve, reject, timer } = pendingRequests.get(msg.id)
        clearTimeout(timer)
        pendingRequests.delete(msg.id)
        if (msg.error) reject(new Error(msg.error))
        else resolve(msg.result)
      }
    } catch {}
  })

  ws.on('close', () => {
    console.log('[claude-lens] extension control disconnected')
    if (controlWs === ws) controlWs = null
    // Reject all pending
    for (const [id, { reject, timer }] of pendingRequests) {
      clearTimeout(timer)
      reject(new Error('Extension disconnected'))
      pendingRequests.delete(id)
    }
  })
}

function queryExtension(action, params, timeout = 10000) {
  return new Promise((resolve, reject) => {
    if (!controlWs || controlWs.readyState !== WebSocket.OPEN) {
      reject(new Error('Extension not connected. Open the Claude Lens side panel.'))
      return
    }

    const id = ++requestId
    const timer = setTimeout(() => {
      pendingRequests.delete(id)
      reject(new Error('Extension query timed out'))
    }, timeout)

    pendingRequests.set(id, { resolve, reject, timer })
    controlWs.send(JSON.stringify({ id, action, ...params }))
  })
}

// ── Terminal Connection (sidepanel.js) ──

function handleTerminalConnection(ws) {
  console.log('[claude-lens] terminal client connected, spawning claude...')

  const shell = pty.spawn(CLAUDE_BIN, ['--dangerously-skip-permissions'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: '/Users/koo/Desktop/dev/page-lens',
    env: { ...process.env, FORCE_COLOR: '1' },
  })

  shell.onData((data) => {
    try { ws.send(data) } catch {}
  })

  shell.onExit(({ exitCode }) => {
    console.log(`[claude-lens] claude exited (code ${exitCode})`)
    try {
      ws.send(`\r\n[claude exited with code ${exitCode}]\r\n`)
      ws.close()
    } catch {}
  })

  ws.on('message', (raw) => {
    const msg = raw.toString()
    try {
      const parsed = JSON.parse(msg)
      if (parsed.type === 'resize') {
        shell.resize(parsed.cols, parsed.rows)
        return
      }
      if (parsed.type === 'inject') {
        // Write picked element data into Claude's stdin
        shell.write(parsed.text)
        return
      }
    } catch {}
    shell.write(msg)
  })

  ws.on('close', () => {
    console.log('[claude-lens] terminal client disconnected')
    shell.kill()
  })

  ws.on('error', (err) => {
    console.error('[claude-lens] terminal ws error:', err.message)
    shell.kill()
  })
}

// ── Start ──

httpServer.listen(PORT, () => {
  console.log(`[claude-lens] claude binary: ${CLAUDE_BIN}`)
  console.log(`[claude-lens] server listening on http://localhost:${PORT}`)
  console.log(`[claude-lens]   terminal: ws://localhost:${PORT}/terminal`)
  console.log(`[claude-lens]   control:  ws://localhost:${PORT}/control`)
  console.log(`[claude-lens]   api:      http://localhost:${PORT}/api/page`)
})

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[claude-lens] port ${PORT} already in use`)
    process.exit(1)
  }
})
