const { execSync } = require('child_process')
const path = require('path')
const pty = require('node-pty')

function detectClaudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN
  try {
    return execSync('which claude', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

class ClaudeService {
  constructor() {
    this._binary = detectClaudeBin()
  }

  setBinary(path) {
    this._binary = path
  }

  handleTerminalConnection(ws, options = {}) {
    if (!this._binary) {
      ws.send('\r\n[error] Claude CLI not found. Set the path in Settings.\r\n')
      ws.close(4001, 'claude_not_found')
      return
    }

    const cwd = options.cwd || path.join(__dirname, '..', '..')
    const skipPerm = options.skipPermissions !== false
    const args = skipPerm ? ['--dangerously-skip-permissions'] : []
    console.log(`[claude-lens] terminal client connected, cwd: ${cwd}, skipPerm: ${skipPerm}`)

    const shell = pty.spawn(this._binary, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd,
      env: { ...process.env, FORCE_COLOR: '1' },
    })

    shell.onData((data) => {
      try { ws.send(data) } catch {}
    })

    shell.onExit(({ exitCode }) => {
      console.log(`[claude-lens] claude exited (code ${exitCode})`)
      try {
        ws.send(`\r\n[claude exited with code ${exitCode}]\r\n`)
        ws.close(4002, 'session_ended')
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

  get binary() {
    return this._binary
  }
}

module.exports = { ClaudeService }
