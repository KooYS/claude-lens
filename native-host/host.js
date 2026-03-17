#!/usr/bin/env node

const { spawn } = require('child_process')
const path = require('path')

// ── Native Messaging Protocol ──

function readMessage() {
  return new Promise((resolve, reject) => {
    const header = Buffer.alloc(4)
    let offset = 0

    function onReadable() {
      const chunk = process.stdin.read(4 - offset)
      if (!chunk) return
      chunk.copy(header, offset)
      offset += chunk.length
      if (offset < 4) return

      process.stdin.removeListener('readable', onReadable)
      const length = header.readUInt32LE(0)
      const body = process.stdin.read(length)
      if (body) {
        resolve(JSON.parse(body.toString()))
      } else {
        process.stdin.once('readable', () => {
          const body = process.stdin.read(length)
          resolve(JSON.parse(body.toString()))
        })
      }
    }

    process.stdin.on('readable', onReadable)
    setTimeout(() => reject(new Error('timeout')), 5000)
  })
}

function sendMessage(msg) {
  const json = JSON.stringify(msg)
  const header = Buffer.alloc(4)
  header.writeUInt32LE(json.length, 0)
  process.stdout.write(header)
  process.stdout.write(json)
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function checkServer(port) {
  try {
    const res = await fetch(`http://localhost:${port}/api/status`)
    return res.ok
  } catch {
    return false
  }
}

// ── Main ──

async function main() {
  try {
    const msg = await readMessage()

    if (msg.action === 'start') {
      const port = msg.port || 19280
      const claudeBin = msg.claudeBin || undefined

      // Already running?
      if (await checkServer(port)) {
        sendMessage({ success: true, alreadyRunning: true })
        return
      }

      // Spawn server as detached process
      const serverPath = path.join(__dirname, '..', 'server', 'index.js')
      const env = { ...process.env, PORT: String(port) }
      if (claudeBin) env.CLAUDE_BIN = claudeBin

      const child = spawn('node', [serverPath], {
        detached: true,
        stdio: 'ignore',
        env,
      })
      child.unref()

      // Poll until ready (max 5 seconds)
      for (let i = 0; i < 20; i++) {
        await sleep(250)
        if (await checkServer(port)) {
          sendMessage({ success: true, pid: child.pid })
          return
        }
      }

      sendMessage({ success: false, error: 'Server did not start in time' })
    } else {
      sendMessage({ success: false, error: `Unknown action: ${msg.action}` })
    }
  } catch (err) {
    sendMessage({ success: false, error: err.message })
  }
}

main().then(() => process.exit(0))
