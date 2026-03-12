class WsController {
  constructor(bridgeService, claudeService) {
    this.bridge = bridgeService
    this.claude = claudeService
  }

  handleConnection(ws, req, port) {
    const url = new URL(req.url, `http://localhost:${port}`)

    if (url.pathname === '/control') {
      this.bridge.handleControlConnection(ws)
    } else if (url.pathname === '/terminal') {
      this.claude.handleTerminalConnection(ws)
    } else {
      ws.close(4000, 'Unknown path. Use /terminal or /control')
    }
  }
}

module.exports = { WsController }
