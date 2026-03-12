const { WebSocket } = require('ws')

class BridgeService {
  constructor() {
    /** @type {WebSocket|null} */
    this.controlWs = null
    this.requestId = 0
    this.pendingRequests = new Map()
  }

  handleControlConnection(ws) {
    console.log('[claude-lens] extension control connected')
    this.controlWs = ws

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.id && this.pendingRequests.has(msg.id)) {
          const { resolve, reject, timer } = this.pendingRequests.get(msg.id)
          clearTimeout(timer)
          this.pendingRequests.delete(msg.id)
          if (msg.error) reject(new Error(msg.error))
          else resolve(msg.result)
        }
      } catch {}
    })

    ws.on('close', () => {
      console.log('[claude-lens] extension control disconnected')
      if (this.controlWs === ws) this.controlWs = null
      for (const [id, { reject, timer }] of this.pendingRequests) {
        clearTimeout(timer)
        reject(new Error('Extension disconnected'))
        this.pendingRequests.delete(id)
      }
    })
  }

  queryExtension(action, params, timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.controlWs || this.controlWs.readyState !== WebSocket.OPEN) {
        reject(new Error('Extension not connected. Open the Claude Lens side panel.'))
        return
      }

      const id = ++this.requestId
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error('Extension query timed out'))
      }, timeout)

      this.pendingRequests.set(id, { resolve, reject, timer })
      this.controlWs.send(JSON.stringify({ id, action, ...params }))
    })
  }

  isConnected() {
    return this.controlWs?.readyState === WebSocket.OPEN
  }
}

module.exports = { BridgeService }
