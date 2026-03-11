// Page Lens - CLI Interface

const output = document.getElementById('output')
const input = document.getElementById('input')

const COMMANDS = {
  help: 'Show available commands',
  analyze: 'Analyze current page structure',
  tree: 'Show component tree (depth: 1-6, default 4)',
  tech: 'Detect technologies used',
  semantic: 'Show semantic tag usage',
  layout: 'Detect flex/grid layout patterns',
  inspect: 'Inspect element by CSS selector',
  clear: 'Clear terminal',
}

const history = []
let historyIndex = -1

// Boot
printBanner()

// Input handling
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const cmd = input.value.trim()
    if (!cmd) return
    history.unshift(cmd)
    historyIndex = -1
    input.value = ''
    execCommand(cmd)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (historyIndex < history.length - 1) {
      historyIndex++
      input.value = history[historyIndex]
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (historyIndex > 0) {
      historyIndex--
      input.value = history[historyIndex]
    } else {
      historyIndex = -1
      input.value = ''
    }
  }
})

// Keep focus on input
document.addEventListener('click', () => input.focus())

function printBanner() {
  print(`<div class="banner">
<span class="banner-title">Page Lens</span> <span class="c-dim">v0.1.0</span>
<span class="c-muted">Analyze any webpage's DOM, layout, and styles.</span>
<span class="c-dim">Type</span> <span class="c-purple">help</span> <span class="c-dim">to see available commands.</span>
</div>`)
}

async function execCommand(raw) {
  const parts = raw.split(/\s+/)
  const cmd = parts[0].toLowerCase()
  const args = parts.slice(1)

  printCmd(raw)

  try {
    switch (cmd) {
      case 'help':
        printHelp()
        break
      case 'analyze':
        await cmdAnalyze()
        break
      case 'tree':
        await cmdTree(args)
        break
      case 'tech':
        await cmdTech()
        break
      case 'semantic':
        await cmdSemantic()
        break
      case 'layout':
        await cmdLayout()
        break
      case 'inspect':
        await cmdInspect(args.join(' '))
        break
      case 'clear':
        output.innerHTML = ''
        printBanner()
        break
      default:
        printError(`Unknown command: ${cmd}. Type "help" for available commands.`)
    }
  } catch (err) {
    printError(err.message)
  }

  scrollToBottom()
}

// ── Commands ──

function printHelp() {
  let rows = ''
  for (const [cmd, desc] of Object.entries(COMMANDS)) {
    rows += `  <span class="c-purple">${cmd.padEnd(12)}</span><span class="c-muted">${desc}</span>\n`
  }
  print(`<div class="out-heading">Commands</div><pre>${rows}</pre>`)
}

async function cmdAnalyze() {
  const spinnerId = showSpinner('Analyzing page...')
  const { summary } = await sendAction('analyzePage', { depth: 4 })
  hideSpinner(spinnerId)

  let html = `<div class="out-heading">Page Summary</div>`

  html += row('URL', `<span class="c-blue">${esc(summary.url)}</span>`)
  html += row('Title', esc(summary.title))
  html += row('Elements', `<span class="c-bright bold">${summary.totalElements.toLocaleString()}</span>`)
  html += row('Max Depth', summary.maxDepth)
  html += row('Charset', summary.charset)
  html += row('Lang', summary.lang || '<span class="c-dim">-</span>')
  html += row('Doctype', summary.hasDoctype ? '<span class="c-green">yes</span>' : '<span class="c-red">no</span>')

  // Top tags
  html += `<div class="out-heading">Top Tags</div>`
  html += '<table class="out-table"><tr><th>Tag</th><th>Count</th></tr>'
  for (const [tag, count] of summary.topTags) {
    html += `<tr><td class="c-pink">&lt;${esc(tag)}&gt;</td><td class="c-muted">${count}</td></tr>`
  }
  html += '</table>'

  // Semantic
  const semEntries = Object.entries(summary.semanticTags || {})
  if (semEntries.length > 0) {
    html += `<div class="out-heading">Semantic Tags</div>`
    html += semEntries
      .map(([t, c]) => `<span class="out-tag c-green">&lt;${esc(t)}&gt; ${c}</span>`)
      .join(' ')
  }

  // Tech
  if (summary.technologies?.length > 0) {
    html += `<div class="out-heading">Technologies</div>`
    html += summary.technologies
      .map((t) => `<span class="out-tag c-cyan">${esc(t)}</span>`)
      .join(' ')
  }

  print(html)
}

async function cmdTree(args) {
  const depth = Math.min(Math.max(parseInt(args[0]) || 4, 1), 6)
  const spinnerId = showSpinner(`Building tree (depth ${depth})...`)
  const { tree } = await sendAction('analyzePage', { depth })
  hideSpinner(spinnerId)

  if (!tree) {
    printError('Could not build component tree')
    return
  }

  const lines = []
  renderTreeNode(tree, '', true, lines)

  print(`<div class="out-heading">Component Tree</div>
<div>${lines.join('\n')}</div>`)
}

function renderTreeNode(node, prefix, isLast, lines) {
  if (!node) return

  const connector = prefix === '' ? '' : (isLast ? ' \u2514\u2500 ' : ' \u251C\u2500 ')
  const tagClass = node.isSemantic ? 'c-green bold' : 'c-pink'
  const idStr = node.id ? `<span class="c-yellow">#${esc(node.id)}</span>` : ''
  const classStr = node.classes?.length
    ? `<span class="c-blue">.${node.classes.map(esc).join('.')}</span>`
    : ''
  const roleStr = node.role ? ` <span class="c-purple">[${esc(node.role)}]</span>` : ''
  const countStr = node.childCount > 0 ? ` <span class="c-dim">(${node.childCount})</span>` : ''

  lines.push(
    `<div class="tree-line"><span class="indent">${esc(prefix)}${connector}</span><span class="${tagClass}">${esc(node.tag)}</span>${idStr}${classStr}${roleStr}${countStr}</div>`
  )

  const children = node.children || []
  const nextPrefix = prefix === '' ? '' : prefix + (isLast ? '    ' : ' \u2502  ')

  for (let i = 0; i < children.length; i++) {
    renderTreeNode(children[i], nextPrefix, i === children.length - 1, lines)
  }

  if (node.truncated) {
    const truncConn = ' \u2514\u2500 '
    lines.push(
      `<div class="tree-line"><span class="indent">${esc(nextPrefix)}${truncConn}</span><span class="c-dim">... +${node.truncated} more</span></div>`
    )
  }
}

async function cmdTech() {
  const spinnerId = showSpinner('Detecting technologies...')
  const { summary } = await sendAction('analyzePage', { depth: 1 })
  hideSpinner(spinnerId)

  const techs = summary.technologies || []
  if (techs.length === 0) {
    print(`<span class="c-muted">No technologies detected.</span>`)
    return
  }

  print(`<div class="out-heading">Technologies</div>` +
    techs.map((t) => `<span class="out-tag c-cyan">${esc(t)}</span>`).join(' '))
}

async function cmdSemantic() {
  const spinnerId = showSpinner('Scanning semantic tags...')
  const { summary } = await sendAction('analyzePage', { depth: 1 })
  hideSpinner(spinnerId)

  const tags = Object.entries(summary.semanticTags || {})
  const roles = Object.entries(summary.landmarkRoles || {})

  if (tags.length === 0 && roles.length === 0) {
    print(`<span class="c-muted">No semantic tags or landmark roles found.</span>`)
    return
  }

  let html = ''
  if (tags.length > 0) {
    html += `<div class="out-heading">Semantic Tags</div>`
    html += '<table class="out-table"><tr><th>Tag</th><th>Count</th></tr>'
    for (const [t, c] of tags) {
      html += `<tr><td class="c-green">&lt;${esc(t)}&gt;</td><td class="c-muted">${c}</td></tr>`
    }
    html += '</table>'
  }

  if (roles.length > 0) {
    html += `<div class="out-heading">ARIA Landmark Roles</div>`
    html += '<table class="out-table"><tr><th>Role</th><th>Count</th></tr>'
    for (const [r, c] of roles) {
      html += `<tr><td class="c-purple">${esc(r)}</td><td class="c-muted">${c}</td></tr>`
    }
    html += '</table>'
  }

  print(html)
}

async function cmdLayout() {
  const spinnerId = showSpinner('Detecting layout patterns...')
  const { layouts } = await sendAction('detectLayouts')
  hideSpinner(spinnerId)

  let html = `<div class="out-heading">Layout Patterns</div>`
  html += row('Flex containers', `<span class="c-bright bold">${layouts.flexCount}</span>`)
  html += row('Grid containers', `<span class="c-bright bold">${layouts.gridCount}</span>`)

  if (layouts.flex.length > 0) {
    html += `<div class="out-heading">Flex Containers</div>`
    html += '<table class="out-table"><tr><th>Selector</th><th>Direction</th><th>Justify</th><th>Align</th></tr>'
    for (const f of layouts.flex.slice(0, 15)) {
      html += `<tr>
        <td class="c-pink">${esc(f.selector)}</td>
        <td class="c-muted">${f.direction}</td>
        <td class="c-muted">${f.justifyContent}</td>
        <td class="c-muted">${f.alignItems}</td>
      </tr>`
    }
    html += '</table>'
  }

  if (layouts.grid.length > 0) {
    html += `<div class="out-heading">Grid Containers</div>`
    html += '<table class="out-table"><tr><th>Selector</th><th>Columns</th><th>Gap</th></tr>'
    for (const g of layouts.grid.slice(0, 15)) {
      html += `<tr>
        <td class="c-pink">${esc(g.selector)}</td>
        <td class="c-muted">${esc(g.columns)}</td>
        <td class="c-muted">${g.gap}</td>
      </tr>`
    }
    html += '</table>'
  }

  print(html)
}

async function cmdInspect(selector) {
  if (!selector) {
    printError('Usage: inspect <css-selector>\nExample: inspect .header, inspect #main, inspect nav')
    return
  }

  const spinnerId = showSpinner(`Inspecting "${selector}"...`)
  const { info } = await sendAction('getElementInfo', { selector })
  hideSpinner(spinnerId)

  if (!info) {
    printError(`Element not found: ${selector}`)
    return
  }

  let html = `<div class="out-heading">&lt;${esc(info.tag)}&gt;</div>`
  if (info.id) html += row('id', `<span class="c-yellow">${esc(info.id)}</span>`)
  if (info.classes.length) html += row('classes', info.classes.map((c) => `<span class="c-blue">.${esc(c)}</span>`).join(' '))

  html += row('size', `${info.dimensions.width} x ${info.dimensions.height}`)
  html += row('position', `top: ${info.dimensions.top}, left: ${info.dimensions.left}`)
  html += row('children', info.childElementCount)

  if (info.textContent) {
    html += row('text', `<span class="c-dim">"${esc(info.textContent)}"</span>`)
  }

  // Attributes
  const attrEntries = Object.entries(info.attributes || {})
  if (attrEntries.length > 0) {
    html += `<div class="out-heading">Attributes</div>`
    for (const [k, v] of attrEntries) {
      html += row(k, `<span class="c-orange">${esc(v)}</span>`)
    }
  }

  // Styles
  const styleEntries = Object.entries(info.styles || {})
  if (styleEntries.length > 0) {
    html += `<div class="out-heading">Computed Styles</div>`
    for (const [prop, val] of styleEntries) {
      html += row(prop, `<span class="c-cyan">${esc(val)}</span>`)
    }
  }

  print(html)
}

// ── Helpers ──

function sendAction(action, extra = {}) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id
      if (!tabId) return reject(new Error('No active tab'))

      chrome.tabs.sendMessage(tabId, { action, ...extra }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else if (response?.error) {
          reject(new Error(response.error))
        } else {
          resolve(response)
        }
      })
    })
  })
}

function print(html) {
  const block = document.createElement('div')
  block.className = 'out-block'
  block.innerHTML = html
  output.appendChild(block)
  scrollToBottom()
}

function printCmd(text) {
  const block = document.createElement('div')
  block.className = 'out-cmd'
  block.innerHTML = `<span class="c-purple">$</span> <span class="cmd-text">${esc(text)}</span>`
  output.appendChild(block)
}

function printError(msg) {
  print(`<div class="out-error">${esc(msg)}</div>`)
}

function row(label, value) {
  return `<div class="out-row"><span class="label">${esc(label)}</span><span class="value">${value}</span></div>`
}

let spinnerCounter = 0
function showSpinner(text) {
  const id = `spinner-${++spinnerCounter}`
  const el = document.createElement('div')
  el.id = id
  el.className = 'spinner-line'
  el.textContent = `⠋ ${text}`
  output.appendChild(el)
  scrollToBottom()

  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  let i = 0
  el._interval = setInterval(() => {
    i = (i + 1) % frames.length
    el.textContent = `${frames[i]} ${text}`
  }, 80)

  return id
}

function hideSpinner(id) {
  const el = document.getElementById(id)
  if (el) {
    clearInterval(el._interval)
    el.remove()
  }
}

function esc(str) {
  if (str == null) return ''
  const d = document.createElement('div')
  d.textContent = String(str)
  return d.innerHTML
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    output.scrollTop = output.scrollHeight
  })
}
