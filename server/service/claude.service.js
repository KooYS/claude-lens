const { execSync } = require('child_process')
const pty = require('node-pty')

const CLAUDE_BIN = (() => {
  try {
    return execSync('which claude', { encoding: 'utf8' }).trim()
  } catch {
    return '/Users/koo/.local/bin/claude'
  }
})()

class ClaudeService {
  handleTerminalConnection(ws) {
    console.log('[claude-lens] terminal client connected, spawning claude...')

    const shell = pty.spawn(CLAUDE_BIN, ['--dangerously-skip-permissions'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: '/Users/koo/Desktop/dev/claude-rens',
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
    return CLAUDE_BIN
  }
}

module.exports = { ClaudeService }
