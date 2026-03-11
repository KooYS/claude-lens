#!/usr/bin/env node

// Page Lens MCP Server
// Claude Code connects to this via stdio. It queries the main server's HTTP API
// to get page data from the Chrome extension.

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')

const API_BASE = `http://localhost:${process.env.PAGE_LENS_PORT || 19280}/api`

async function apiCall(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

const server = new McpServer({
  name: 'page-lens',
  version: '0.2.0',
})

server.tool(
  'get_page_summary',
  'Get a summary of the current browser page: element count, DOM depth, semantic tags, technologies detected, top tags, URL, title',
  {},
  async () => {
    try {
      const data = await apiCall('/page')
      return { content: [{ type: 'text', text: JSON.stringify(data.summary, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  },
)

server.tool(
  'get_page_tree',
  'Get the component tree of the current browser page as a hierarchical structure',
  { depth: { type: 'number', description: 'Tree depth (1-6, default 4)' } },
  async ({ depth }) => {
    try {
      const d = Math.min(Math.max(depth || 4, 1), 6)
      const data = await apiCall(`/tree?depth=${d}`)
      return { content: [{ type: 'text', text: JSON.stringify(data.tree, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  },
)

server.tool(
  'get_element_info',
  'Get detailed info about a specific element on the page: tag, classes, dimensions, computed styles, attributes',
  { selector: { type: 'string', description: 'CSS selector for the element (e.g., ".header", "#main", "nav")' } },
  async ({ selector }) => {
    try {
      const data = await apiCall(`/element?selector=${encodeURIComponent(selector)}`)
      return { content: [{ type: 'text', text: JSON.stringify(data.info, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  },
)

server.tool(
  'get_page_html',
  'Get the outer HTML of an element on the current page',
  { selector: { type: 'string', description: 'CSS selector (default: "body")' } },
  async ({ selector }) => {
    try {
      const data = await apiCall(`/html?selector=${encodeURIComponent(selector || 'body')}`)
      return { content: [{ type: 'text', text: data.html || 'No HTML returned' }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  },
)

server.tool(
  'get_layout_info',
  'Detect flex and grid layout patterns on the current page',
  {},
  async () => {
    try {
      const data = await apiCall('/layout')
      return { content: [{ type: 'text', text: JSON.stringify(data.layouts, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[page-lens-mcp] MCP server running on stdio')
}

main().catch((err) => {
  console.error('[page-lens-mcp] fatal:', err)
  process.exit(1)
})
