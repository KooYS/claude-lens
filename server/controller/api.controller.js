class ApiController {
  constructor(bridgeService) {
    this.bridge = bridgeService
  }

  handleRequest(req, res, url) {
    res.setHeader('Access-Control-Allow-Origin', '*')
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
}

module.exports = { ApiController }
