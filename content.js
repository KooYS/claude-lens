// Page Lens - Content Script
// Guard against double injection
if (window.__pageLensLoaded) {
  // Already loaded — just re-register inspector availability
} else {
  window.__pageLensLoaded = true
}

console.log('[page-lens] content script loaded')

// ── Analysis Handlers ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message.action

  if (action === 'ping') {
    sendResponse({ ok: true })
    return
  }

  if (action === 'startInspector') {
    Inspector.start()
    sendResponse({ ok: true })
    return
  }

  if (action === 'stopInspector') {
    Inspector.stop()
    sendResponse({ ok: true })
    return
  }

  if (action === 'analyzePage') {
    try {
      const summary = DomAnalyzer.getPageSummary()
      const tree = DomAnalyzer.buildComponentTree(message.depth || 4)
      sendResponse({ summary, tree })
    } catch (err) {
      sendResponse({ error: err.message })
    }
    return
  }

  if (action === 'getElementInfo') {
    try {
      const info = StyleExtractor.getElementInfo(message.selector)
      sendResponse({ info })
    } catch (err) {
      sendResponse({ error: err.message })
    }
    return
  }

  if (action === 'detectLayouts') {
    try {
      const layouts = LayoutDetector.detectLayouts()
      sendResponse({ layouts })
    } catch (err) {
      sendResponse({ error: err.message })
    }
    return
  }

  if (action === 'getOuterHTML') {
    try {
      const selector = message.selector || 'body'
      const el = document.querySelector(selector)
      if (!el) sendResponse({ error: `Element not found: ${selector}` })
      else sendResponse({ html: el.outerHTML })
    } catch (err) {
      sendResponse({ error: err.message })
    }
    return
  }
})

// ── Element Inspector ──

const Inspector = (() => {
  let active = false
  let overlay = null
  let label = null
  let hoveredEl = null

  function start() {
    if (active) stop() // reset if already active
    active = true
    createOverlay()
    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.body.style.cursor = 'crosshair'
    console.log('[page-lens] inspector started')
  }

  function stop() {
    if (!active) return
    active = false
    removeOverlay()
    document.removeEventListener('mousemove', onMouseMove, true)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('keydown', onKeyDown, true)
    document.body.style.cursor = ''
    hoveredEl = null
    console.log('[page-lens] inspector stopped')
  }

  function createOverlay() {
    removeOverlay() // clean up any existing
    overlay = document.createElement('div')
    overlay.id = '__page-lens-overlay'
    overlay.style.cssText = `
      position: fixed; pointer-events: none; z-index: 2147483647;
      border: 2px solid #a78bfa; background: rgba(167,139,250,0.08);
      border-radius: 2px; transition: all 0.05s ease-out;
      display: none;
    `

    label = document.createElement('div')
    label.id = '__page-lens-label'
    label.style.cssText = `
      position: fixed; pointer-events: none; z-index: 2147483647;
      background: #1e1b4b; color: #e0e7ff; font-family: 'SF Mono', monospace;
      font-size: 11px; padding: 3px 8px; border-radius: 4px;
      white-space: nowrap; display: none; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    `

    document.documentElement.appendChild(overlay)
    document.documentElement.appendChild(label)
  }

  function removeOverlay() {
    document.getElementById('__page-lens-overlay')?.remove()
    document.getElementById('__page-lens-label')?.remove()
    overlay = null
    label = null
  }

  function onMouseMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    if (!el || el === overlay || el === label || el.id?.startsWith('__page-lens')) return
    hoveredEl = el

    const rect = el.getBoundingClientRect()
    overlay.style.top = rect.top + 'px'
    overlay.style.left = rect.left + 'px'
    overlay.style.width = rect.width + 'px'
    overlay.style.height = rect.height + 'px'
    overlay.style.display = 'block'

    const tag = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ''
    const cls = el.classList.length ? `.${Array.from(el.classList).slice(0, 2).join('.')}` : ''
    const size = `${Math.round(rect.width)}\u00D7${Math.round(rect.height)}`
    label.textContent = `${tag}${id}${cls}  ${size}`

    const labelY = rect.top > 28 ? rect.top - 24 : rect.bottom + 4
    label.style.top = labelY + 'px'
    label.style.left = Math.max(0, rect.left) + 'px'
    label.style.display = 'block'
  }

  function onClick(e) {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()

    if (!hoveredEl) return

    const data = captureElement(hoveredEl)
    stop()

    chrome.storage.local.set({ pickedElement: data, pickedAt: Date.now() })
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      stop()
      chrome.storage.local.set({ pickedElement: null, pickedAt: Date.now() })
    }
  }

  function captureElement(el) {
    // Build a compact structural summary instead of raw HTML
    const lines = []
    buildStructureTree(el, '', true, lines, 0, 4)

    return {
      pageUrl: location.href,
      tree: lines.join('\n'),
    }
  }

  // Compact tree: <tag#id.class> size | layout-info
  function buildStructureTree(el, prefix, isLast, lines, depth, maxDepth) {
    if (!el || depth > maxDepth) return

    const tag = el.tagName.toLowerCase()
    if (['script', 'style', 'noscript', 'link', 'meta', 'br', 'hr'].includes(tag)) return

    const id = el.id ? `#${el.id}` : ''
    const cls = el.classList.length
      ? `.${Array.from(el.classList).slice(0, 3).join('.')}`
      : ''
    const rect = el.getBoundingClientRect()
    const computed = getComputedStyle(el)

    // Size
    const w = Math.round(rect.width)
    const h = Math.round(rect.height)
    const size = (w || h) ? `${w}\u00D7${h}` : ''

    // Layout hints (only meaningful ones)
    const hints = []
    const display = computed.display
    if (display === 'flex' || display === 'inline-flex') {
      const dir = computed.flexDirection
      const justify = computed.justifyContent
      const align = computed.alignItems
      let flex = `flex`
      if (dir !== 'row') flex += ` ${dir}`
      if (justify !== 'normal' && justify !== 'flex-start') flex += ` ${justify}`
      if (align !== 'normal' && align !== 'stretch') flex += ` align:${align}`
      const gap = computed.gap
      if (gap && gap !== 'normal' && gap !== '0px') flex += ` gap:${gap}`
      hints.push(flex)
    } else if (display === 'grid' || display === 'inline-grid') {
      const cols = computed.gridTemplateColumns
      // Summarize grid: count columns
      const colCount = cols.split(/\s+/).length
      hints.push(`grid ${colCount}col`)
    } else if (display !== 'block' && display !== 'inline' && display !== '') {
      hints.push(display)
    }

    if (computed.position !== 'static') hints.push(`pos:${computed.position}`)
    if (computed.overflow !== 'visible') hints.push(`overflow:${computed.overflow}`)

    // Key attributes for non-div elements
    const attrs = []
    if (tag === 'a') attrs.push(`href="${(el.getAttribute('href') || '').slice(0, 50)}"`)
    if (tag === 'img') attrs.push(`src="${(el.getAttribute('src') || '').slice(0, 50)}"`)
    if (tag === 'input') attrs.push(`type="${el.type}"`)
    if (el.getAttribute('role')) attrs.push(`role="${el.getAttribute('role')}"`)
    if (el.getAttribute('aria-label')) attrs.push(`aria="${el.getAttribute('aria-label').slice(0, 30)}"`)

    // Text content (leaf nodes only, short)
    let text = ''
    if (el.childElementCount === 0 && el.textContent?.trim()) {
      const t = el.textContent.trim()
      if (t.length <= 40) text = ` "${t}"`
      else text = ` "${t.slice(0, 37)}..."`
    }

    // Build line
    const connector = prefix === '' ? '' : (isLast ? '\u2514\u2500 ' : '\u251C\u2500 ')
    const meta = [size, ...hints, ...attrs].filter(Boolean).join(' | ')
    const metaStr = meta ? ` ${meta}` : ''
    lines.push(`${prefix}${connector}<${tag}${id}${cls}>${metaStr}${text}`)

    // Children
    const children = Array.from(el.children).filter((c) => {
      const t = c.tagName.toLowerCase()
      return !['script', 'style', 'noscript', 'link', 'meta', 'br', 'hr'].includes(t)
    })

    // If too many similar children, collapse
    if (children.length > 8) {
      const groups = {}
      for (const c of children) {
        const key = c.tagName.toLowerCase() + (c.className ? `.${c.classList[0]}` : '')
        groups[key] = (groups[key] || 0) + 1
      }

      const nextPrefix = prefix === '' ? '' : prefix + (isLast ? '   ' : '\u2502  ')
      // Show first 3, then summary
      for (let i = 0; i < Math.min(3, children.length); i++) {
        buildStructureTree(children[i], nextPrefix, i === 2 && children.length <= 3, lines, depth + 1, maxDepth)
      }
      if (children.length > 3) {
        const summary = Object.entries(groups).map(([k, v]) => `<${k}>\u00D7${v}`).join(', ')
        lines.push(`${nextPrefix}\u2514\u2500 ... ${children.length} children: ${summary}`)
      }
      return
    }

    const nextPrefix = prefix === '' ? '' : prefix + (isLast ? '   ' : '\u2502  ')
    for (let i = 0; i < children.length; i++) {
      buildStructureTree(children[i], nextPrefix, i === children.length - 1, lines, depth + 1, maxDepth)
    }
  }

  return { start, stop }
})()
