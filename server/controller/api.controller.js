class ApiController {
  constructor(bridgeService, claudeService) {
    this.bridge = bridgeService
    this.claude = claudeService
  }

  handleRequest(req, res, url) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const route = this.routes[url.pathname]
    if (route) {
      route.call(this, req, res, url)
    } else {
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'not found' }))
    }
  }

  get routes() {
    return {
      '/api/page': this.getPage,
      '/api/tree': this.getTree,
      '/api/element': this.getElement,
      '/api/layout': this.getLayout,
      '/api/html': this.getHtml,
      '/api/eval': this.getEval,
      '/api/pageinfo': this.getPageInfo,
      '/api/inputs': this.getInputs,
      '/api/text': this.getText,
      '/api/status': this.getStatus,
      '/api/pick-dir': this.pickDir,
      '/api/network/start': this.networkStart,
      '/api/network/stop': this.networkStop,
      '/api/network/requests': this.networkGetRequests,
      '/api/network/response-body': this.networkGetResponseBody,
      '/api/network/clear': this.networkClear,
      '/api/claude-bin': this.claudeBin,
      '/api/mcp-path': this.getMcpPath,
      '/api/pick-file': this.pickFile,
    }
  }

  getPage(req, res) {
    this.bridge.queryExtension('analyzePage', { depth: 4 })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  getTree(req, res, url) {
    const depth = parseInt(url.searchParams.get('depth')) || 4
    this.bridge.queryExtension('analyzePage', { depth })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify({ tree: data.tree })) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  getElement(req, res, url) {
    const selector = url.searchParams.get('selector')
    if (!selector) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'selector param required' })); return
    }
    this.bridge.queryExtension('getElementInfo', { selector })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  getLayout(req, res) {
    this.bridge.queryExtension('detectLayouts', {})
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  getHtml(req, res, url) {
    const selector = url.searchParams.get('selector') || 'body'
    this.bridge.queryExtension('getOuterHTML', { selector })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  getEval(req, res, url) {
    const code = url.searchParams.get('code')
    if (!code) { res.writeHead(400); res.end(JSON.stringify({ error: 'code param required' })); return }
    this.bridge.queryExtension('evaluateJS', { code })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  getPageInfo(req, res) {
    this.bridge.queryExtension('getPageInfo', {})
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  getInputs(req, res) {
    this.bridge.queryExtension('getInputValues', {})
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  getText(req, res, url) {
    const selector = url.searchParams.get('selector') || 'body'
    const maxLength = parseInt(url.searchParams.get('maxLength')) || 2000
    this.bridge.queryExtension('getVisibleText', { selector, maxLength })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  getStatus(req, res) {
    res.writeHead(200)
    res.end(JSON.stringify({ connected: this.bridge.isConnected() }))
  }

  pickDir(req, res, url) {
    const { execSync } = require('child_process')
    const os = require('os')
    const defaultPath = url.searchParams.get('default') || os.homedir()

    try {
      const script = `osascript -e 'POSIX path of (choose folder with prompt "Select working directory" default location POSIX file "${defaultPath}")'`
      const selected = execSync(script, { encoding: 'utf8', timeout: 60000 }).trim()
      // osascript returns path with trailing slash
      const cleaned = selected.endsWith('/') ? selected.slice(0, -1) : selected
      res.writeHead(200)
      res.end(JSON.stringify({ path: cleaned }))
    } catch (err) {
      // User cancelled the dialog
      res.writeHead(200)
      res.end(JSON.stringify({ path: null, cancelled: true }))
    }
  }
  networkStart(req, res) {
    this.bridge.queryExtension('networkStart', {})
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  networkStop(req, res) {
    this.bridge.queryExtension('networkStop', {})
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  networkGetRequests(req, res, url) {
    const filter = {}
    if (url.searchParams.get('type')) filter.type = url.searchParams.get('type')
    if (url.searchParams.get('urlPattern')) filter.urlPattern = url.searchParams.get('urlPattern')
    if (url.searchParams.get('statusCode')) filter.statusCode = parseInt(url.searchParams.get('statusCode'))
    if (url.searchParams.get('limit')) filter.limit = parseInt(url.searchParams.get('limit'))
    this.bridge.queryExtension('networkGetRequests', { filter })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  networkGetResponseBody(req, res, url) {
    const requestId = url.searchParams.get('requestId')
    if (!requestId) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'requestId param required' })); return
    }
    this.bridge.queryExtension('networkGetResponseBody', { requestId })
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  networkClear(req, res) {
    this.bridge.queryExtension('networkClear', {})
      .then((data) => { res.writeHead(200); res.end(JSON.stringify(data)) })
      .catch((err) => { res.writeHead(502); res.end(JSON.stringify({ error: err.message })) })
  }

  claudeBin(req, res, url) {
    if (req.method === 'POST') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        try {
          const { path } = JSON.parse(body)
          this.claude.setBinary(path)
          res.writeHead(200)
          res.end(JSON.stringify({ path: this.claude.binary }))
        } catch {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'invalid body' }))
        }
      })
      return
    }
    res.writeHead(200)
    res.end(JSON.stringify({ path: this.claude.binary }))
  }

  getMcpPath(req, res) {
    const path = require('path')
    res.writeHead(200)
    res.end(JSON.stringify({ path: path.join(__dirname, '..', 'mcp-server.js') }))
  }

  pickFile(req, res, url) {
    const { execSync } = require('child_process')
    const defaultPath = url.searchParams.get('default') || '/usr/local/bin'
    try {
      const script = `osascript -e 'POSIX path of (choose file with prompt "Select Claude CLI binary" default location POSIX file "${defaultPath}")'`
      const selected = execSync(script, { encoding: 'utf8', timeout: 60000 }).trim()
      res.writeHead(200)
      res.end(JSON.stringify({ path: selected }))
    } catch {
      res.writeHead(200)
      res.end(JSON.stringify({ path: null, cancelled: true }))
    }
  }
}

module.exports = { ApiController }
