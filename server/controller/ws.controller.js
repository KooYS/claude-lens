class WsController {
  constructor(bridgeService, claudeService) {
    this.bridge = bridgeService
    this.claude = claudeService
  }

  handleConnection(ws, req, port) {
    const url = new URL(req.url, `http://localhost:${port}`)
    const cwd = url.searchParams.get('cwd') || undefined
    const skipPermissions = url.searchParams.get('skipPerm') !== 'false'

    if (url.pathname === '/control') {
      this.bridge.handleControlConnection(ws)
    } else if (url.pathname === '/terminal') {
      this.claude.handleTerminalConnection(ws, { cwd, skipPermissions })
    } else {
      ws.close(4000, 'Unknown path. Use /terminal or /control')
    }
  }
}

module.exports = { WsController }
