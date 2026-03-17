#!/usr/bin/env node

// Claude Lens MCP Server
// Gives Claude Code access to the CURRENT Chrome tab via the extension.
// Communicates with the main server's HTTP API.

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')

const API_BASE = `http://localhost:${process.env.CLAUDE_LENS_PORT || 19280}/api`

async function api(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

function result(text) {
  return { content: [{ type: 'text', text }] }
}

function error(err) {
  return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
}

const server = new McpServer({
  name: 'claude-lens',
  version: '0.2.0',
})

// ── Current page info ──

server.tool(
  'get_current_page',
  'Get the URL, title, and basic info of the current Chrome tab the user is viewing',
  {},
  async () => {
    try {
      const data = await api('/pageinfo')
      return result(JSON.stringify(data, null, 2))
    } catch (err) { return error(err) }
  },
)

// ── Page structure analysis ──

server.tool(
  'get_page_summary',
  'Analyze the current Chrome page: element count, DOM depth, semantic tags, technologies, top tags',
  {},
  async () => {
    try {
      const data = await api('/page')
      return result(JSON.stringify(data.summary, null, 2))
    } catch (err) { return error(err) }
  },
)

server.tool(
  'get_page_tree',
  'Get the component tree of the current Chrome page',
  { depth: z.number().optional().describe('Tree depth 1-6 (default 4)') },
  async ({ depth }) => {
    try {
      const d = Math.min(Math.max(depth || 4, 1), 6)
      const data = await api(`/tree?depth=${d}`)
      return result(JSON.stringify(data.tree, null, 2))
    } catch (err) { return error(err) }
  },
)

// ── Read page content ──

server.tool(
  'get_visible_text',
  'Get the visible text content of an element on the current Chrome page',
  {
    selector: z.string().optional().describe('CSS selector (default: "body")'),
    maxLength: z.number().optional().describe('Max characters to return (default: 2000)'),
  },
  async ({ selector, maxLength }) => {
    try {
      const s = encodeURIComponent(selector || 'body')
      const m = maxLength || 2000
      const data = await api(`/text?selector=${s}&maxLength=${m}`)
      return result(data.text)
    } catch (err) { return error(err) }
  },
)

server.tool(
  'get_input_values',
  'Get all input/textarea/select values currently filled in on the page',
  {},
  async () => {
    try {
      const data = await api('/inputs')
      return result(JSON.stringify(data.values, null, 2))
    } catch (err) { return error(err) }
  },
)

// ── Element inspection ──

server.tool(
  'get_element_info',
  'Get detailed info about a specific element: tag, classes, dimensions, computed styles',
  { selector: z.string().describe('CSS selector (e.g., ".header", "#main", "nav")') },
  async ({ selector }) => {
    try {
      const data = await api(`/element?selector=${encodeURIComponent(selector)}`)
      return result(JSON.stringify(data.info, null, 2))
    } catch (err) { return error(err) }
  },
)

server.tool(
  'get_element_html',
  'Get the outer HTML of an element on the current page',
  { selector: z.string().optional().describe('CSS selector (default: "body")') },
  async ({ selector }) => {
    try {
      const data = await api(`/html?selector=${encodeURIComponent(selector || 'body')}`)
      return result(data.html || 'No HTML returned')
    } catch (err) { return error(err) }
  },
)

// ── Layout analysis ──

server.tool(
  'get_layout_info',
  'Detect flex and grid layout patterns on the current page',
  {},
  async () => {
    try {
      const data = await api('/layout')
      return result(JSON.stringify(data.layouts, null, 2))
    } catch (err) { return error(err) }
  },
)

// ── JavaScript execution ──

server.tool(
  'run_js_on_page',
  'Execute JavaScript code on the current Chrome page and return the result. Use this to read any value, interact with the page, or check state.',
  { code: z.string().describe('JavaScript code to execute (should return a value)') },
  async ({ code }) => {
    try {
      const data = await api(`/eval?code=${encodeURIComponent(code)}`)
      return result(data.result)
    } catch (err) { return error(err) }
  },
)

// ── Network capture ──

server.tool(
  'start_network_capture',
  'Start capturing network requests on the current Chrome tab. Uses Chrome DevTools Protocol via debugger. A yellow "debugging" bar will appear on the page — this is expected. Call get_network_requests to retrieve captured data.',
  {},
  async () => {
    try {
      const data = await api('/network/start')
      return result('Network capture started. Use get_network_requests() to view captured requests.')
    } catch (err) { return error(err) }
  },
)

server.tool(
  'get_network_requests',
  'Get captured network requests. Must call start_network_capture first. Returns URL, method, status, type, size, and mimeType for each request.',
  {
    type: z.string().optional().describe('Filter by resource type (comma-separated): XHR, Fetch, Document, Stylesheet, Script, Image, Media, Font, WebSocket, Other'),
    urlPattern: z.string().optional().describe('Regex pattern to filter URLs (e.g., "api\\\\.twitter|video\\\\.twimg")'),
    statusCode: z.number().optional().describe('Filter by HTTP status code (e.g., 200, 404)'),
    limit: z.number().optional().describe('Max requests to return (default: 200, most recent)'),
  },
  async ({ type, urlPattern, statusCode, limit }) => {
    try {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      if (urlPattern) params.set('urlPattern', urlPattern)
      if (statusCode) params.set('statusCode', statusCode)
      if (limit) params.set('limit', limit)
      const qs = params.toString()
      const data = await api(`/network/requests${qs ? '?' + qs : ''}`)
      return result(JSON.stringify(data, null, 2))
    } catch (err) { return error(err) }
  },
)

server.tool(
  'get_network_response_body',
  'Get the response body of a specific captured network request. The network capture must still be active (not stopped).',
  { requestId: z.string().describe('The requestId from get_network_requests results') },
  async ({ requestId }) => {
    try {
      const data = await api(`/network/response-body?requestId=${encodeURIComponent(requestId)}`)
      if (data.base64Encoded) {
        return result(`[Base64 encoded response - ${data.body.length} chars]\nFirst 500 chars: ${data.body.substring(0, 500)}`)
      }
      return result(data.body)
    } catch (err) { return error(err) }
  },
)

server.tool(
  'stop_network_capture',
  'Stop capturing network requests and detach the debugger. The yellow debugging bar will disappear.',
  {},
  async () => {
    try {
      const data = await api('/network/stop')
      return result('Network capture stopped.')
    } catch (err) { return error(err) }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[claude-lens-mcp] running — tools for current Chrome tab')
}

main().catch((err) => {
  console.error('[claude-lens-mcp] fatal:', err)
  process.exit(1)
})
