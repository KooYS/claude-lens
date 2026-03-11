const { WebSocketServer } = require('ws')
const pty = require('node-pty')

const PORT = parseInt(process.env.PORT, 10) || 19280

const wss = new WebSocketServer({ port: PORT })
console.log(`[page-lens] server listening on ws://localhost:${PORT}`)

wss.on('connection', (ws) => {
  console.log('[page-lens] client connected, spawning claude...')

  const shell = pty.spawn('claude', [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: { ...process.env, FORCE_COLOR: '1' },
  })

  shell.onData((data) => {
    try {
      ws.send(data)
    } catch {
      // client disconnected
    }
  })

  shell.onExit(({ exitCode }) => {
    console.log(`[page-lens] claude exited (code ${exitCode})`)
    try {
      ws.send(`\r\n[claude exited with code ${exitCode}]\r\n`)
      ws.close()
    } catch {
      // ignore
    }
  })

  ws.on('message', (raw) => {
    const msg = raw.toString()

    // Handle resize messages
    try {
      const parsed = JSON.parse(msg)
      if (parsed.type === 'resize') {
        shell.resize(parsed.cols, parsed.rows)
        return
      }
    } catch {
      // not JSON, treat as terminal input
    }

    shell.write(msg)
  })

  ws.on('close', () => {
    console.log('[page-lens] client disconnected')
    shell.kill()
  })

  ws.on('error', (err) => {
    console.error('[page-lens] ws error:', err.message)
    shell.kill()
  })
})

wss.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[page-lens] port ${PORT} is already in use`)
    process.exit(1)
  }
  console.error('[page-lens] server error:', err.message)
})
