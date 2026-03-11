#!/usr/bin/env node

// Page Lens MCP Server
// Gives Claude Code access to the CURRENT Chrome tab via the extension.
// Communicates with the main server's HTTP API.

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')

const API_BASE = `http://localhost:${process.env.PAGE_LENS_PORT || 19280}/api`

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
  name: 'page-lens',
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
  { depth: { type: 'number', description: 'Tree depth 1-6 (default 4)' } },
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
    selector: { type: 'string', description: 'CSS selector (default: "body")' },
    maxLength: { type: 'number', description: 'Max characters to return (default: 2000)' },
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
  { selector: { type: 'string', description: 'CSS selector (e.g., ".header", "#main", "nav")' } },
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
  { selector: { type: 'string', description: 'CSS selector (default: "body")' } },
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
  { code: { type: 'string', description: 'JavaScript code to execute (should return a value)' } },
  async ({ code }) => {
    try {
      const data = await api(`/eval?code=${encodeURIComponent(code)}`)
      return result(data.result)
    } catch (err) { return error(err) }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[page-lens-mcp] running — tools for current Chrome tab')
}

main().catch((err) => {
  console.error('[page-lens-mcp] fatal:', err)
  process.exit(1)
})
