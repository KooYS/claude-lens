const http = require('http')
const { WebSocketServer } = require('ws')

const { ApiController } = require('./controller/api.controller')
const { WsController } = require('./controller/ws.controller')
const { BridgeService } = require('./service/bridge.service')
const { ClaudeService } = require('./service/claude.service')

const PORT = parseInt(process.env.PORT, 10) || 19280

// ── Assemble ──

const bridgeService = new BridgeService()
const claudeService = new ClaudeService()
const apiController = new ApiController(bridgeService)
const wsController = new WsController(bridgeService, claudeService)

// ── HTTP Server ──

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  apiController.handleRequest(req, res, url)
})

// ── WebSocket Server ──

const wss = new WebSocketServer({ server: httpServer })

wss.on('connection', (ws, req) => {
  wsController.handleConnection(ws, req, PORT)
})

// ── Start ──

httpServer.listen(PORT, () => {
  console.log(`[claude-lens] claude binary: ${claudeService.binary}`)
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
