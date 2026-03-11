// Page Lens - Side Panel Script

const $ = (sel) => document.querySelector(sel)
const analyzeBtn = $('#analyzeBtn')
const resultsEl = $('#results')
const loadingEl = $('#loading')
const errorEl = $('#error')
const pageUrlEl = $('#pageUrl')

// Section toggle
document.querySelectorAll('.section__title').forEach((title) => {
  title.addEventListener('click', () => {
    title.classList.toggle('open')
  })
})

// Analyze button
analyzeBtn.addEventListener('click', () => {
  analyzePage()
})

// Update page URL on panel open
updatePageInfo()

async function updatePageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab) {
      pageUrlEl.textContent = tab.url || '-'
      pageUrlEl.title = tab.url || ''
    }
  } catch {
    pageUrlEl.textContent = '-'
  }
}

async function analyzePage() {
  showLoading(true)
  hideError()
  resultsEl.classList.add('hidden')

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id) throw new Error('No active tab found')

    pageUrlEl.textContent = tab.url || '-'
    pageUrlEl.title = tab.url || ''

    const response = await sendToContent(tab.id, { action: 'analyzePage', depth: 4 })
    if (response.error) throw new Error(response.error)

    renderSummary(response.summary)
    renderTechnologies(response.summary.technologies)
    renderSemanticTags(response.summary.semanticTags)
    renderTree(response.tree)

    resultsEl.classList.remove('hidden')

    // Open summary section by default
    document.querySelector('[data-toggle="summary"]')?.classList.add('open')
    document.querySelector('[data-toggle="tree"]')?.classList.add('open')
  } catch (err) {
    showError(err.message)
  } finally {
    showLoading(false)
  }
}

function sendToContent(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else {
        resolve(response || {})
      }
    })
  })
}

function renderSummary(summary) {
  const el = $('#summarySection')
  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat">
        <div class="stat__label">Elements</div>
        <div class="stat__value">${summary.totalElements.toLocaleString()}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Max Depth</div>
        <div class="stat__value">${summary.maxDepth}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Charset</div>
        <div class="stat__value" style="font-size:13px">${summary.charset}</div>
      </div>
      <div class="stat">
        <div class="stat__label">Lang</div>
        <div class="stat__value" style="font-size:13px">${summary.lang || '-'}</div>
      </div>
    </div>
    <div style="margin-top:8px">
      <div class="stat__label" style="margin-bottom:4px">Top Tags</div>
      <div class="tag-list">
        ${summary.topTags.map(([tag, count]) =>
          `<span class="tag">&lt;${escapeHtml(tag)}&gt; <span class="tag__count">${count}</span></span>`
        ).join('')}
      </div>
    </div>
  `
}

function renderTechnologies(techs) {
  const el = $('#techsSection')
  if (!techs || techs.length === 0) {
    el.innerHTML = '<p class="no-data">No technologies detected</p>'
    return
  }
  el.innerHTML = techs.map((t) => `<span class="tech-badge">${escapeHtml(t)}</span>`).join('')
}

function renderSemanticTags(tags) {
  const el = $('#semanticSection')
  const entries = Object.entries(tags || {})
  if (entries.length === 0) {
    el.innerHTML = '<p class="no-data">No semantic tags found</p>'
    return
  }
  el.innerHTML = `
    <div class="tag-list">
      ${entries.map(([tag, count]) =>
        `<span class="tag" style="color:#34d399">&lt;${escapeHtml(tag)}&gt; <span class="tag__count">${count}</span></span>`
      ).join('')}
    </div>
  `
}

function renderTree(tree) {
  const el = $('#treeSection')
  if (!tree) {
    el.innerHTML = '<p class="no-data">Could not build component tree</p>'
    return
  }
  el.innerHTML = `<div class="tree">${buildTreeHtml(tree, 0)}</div>`

  // Attach toggle listeners
  el.querySelectorAll('.tree-toggle').forEach((toggle) => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation()
      const node = toggle.closest('.tree-node')
      const children = node?.querySelector(':scope > .tree-children')
      if (children) {
        children.classList.toggle('collapsed')
        toggle.textContent = children.classList.contains('collapsed') ? '\u25B6' : '\u25BC'
      }
    })
  })
}

function buildTreeHtml(node, depth) {
  if (!node) return ''

  const hasChildren = node.children && node.children.length > 0
  const toggleHtml = hasChildren
    ? `<span class="tree-toggle">\u25BC</span>`
    : `<span class="tree-toggle" style="visibility:hidden">\u25BC</span>`

  const tagClass = node.isSemantic ? 'tree-tag semantic' : 'tree-tag'
  const idHtml = node.id ? `<span class="tree-id">#${escapeHtml(node.id)}</span>` : ''
  const classHtml = node.classes?.length
    ? `<span class="tree-class">.${node.classes.map(escapeHtml).join('.')}</span>`
    : ''
  const roleHtml = node.role ? `<span class="tree-role">[${escapeHtml(node.role)}]</span>` : ''
  const countHtml = node.childCount > 0
    ? `<span class="tree-count">(${node.childCount})</span>`
    : ''

  let html = `
    <div class="tree-node">
      <span class="tree-label">
        ${toggleHtml}
        <span class="${tagClass}">&lt;${escapeHtml(node.tag)}&gt;</span>
        ${idHtml}${classHtml}${roleHtml}
        ${countHtml}
      </span>
  `

  if (hasChildren) {
    html += `<div class="tree-children${depth >= 2 ? ' collapsed' : ''}">`
    for (const child of node.children) {
      html += buildTreeHtml(child, depth + 1)
    }
    if (node.truncated) {
      html += `<div class="tree-node"><span class="tree-count">... +${node.truncated} more</span></div>`
    }
    html += '</div>'

    // If collapsed by default, update toggle icon
    if (depth >= 2) {
      html = html.replace(
        `<span class="tree-toggle">\u25BC</span>`,
        `<span class="tree-toggle">\u25B6</span>`
      )
    }
  }

  html += '</div>'
  return html
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function showLoading(show) {
  loadingEl.classList.toggle('hidden', !show)
  analyzeBtn.disabled = show
}

function showError(msg) {
  errorEl.textContent = msg
  errorEl.classList.remove('hidden')
}

function hideError() {
  errorEl.classList.add('hidden')
}
