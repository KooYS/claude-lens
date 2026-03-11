// Page Lens - Content Script
// 1. DOM analysis (existing)
// 2. Element inspector overlay

// ── Analysis Handlers ──

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzePage') {
    try {
      const summary = DomAnalyzer.getPageSummary()
      const tree = DomAnalyzer.buildComponentTree(message.depth || 4)
      sendResponse({ summary, tree })
    } catch (err) {
      sendResponse({ error: err.message })
    }
    return true
  }

  if (message.action === 'getElementInfo') {
    try {
      const info = StyleExtractor.getElementInfo(message.selector)
      sendResponse({ info })
    } catch (err) {
      sendResponse({ error: err.message })
    }
    return true
  }

  if (message.action === 'detectLayouts') {
    try {
      const layouts = LayoutDetector.detectLayouts()
      sendResponse({ layouts })
    } catch (err) {
      sendResponse({ error: err.message })
    }
    return true
  }

  if (message.action === 'getOuterHTML') {
    try {
      const selector = message.selector || 'body'
      const el = document.querySelector(selector)
      if (!el) sendResponse({ error: `Element not found: ${selector}` })
      else sendResponse({ html: el.outerHTML })
    } catch (err) {
      sendResponse({ error: err.message })
    }
    return true
  }

  if (message.action === 'startInspector') {
    Inspector.start()
    sendResponse({ ok: true })
    return true
  }

  if (message.action === 'stopInspector') {
    Inspector.stop()
    sendResponse({ ok: true })
    return true
  }
})

// ── Element Inspector ──

const Inspector = (() => {
  let active = false
  let overlay = null
  let label = null
  let hoveredEl = null

  function start() {
    if (active) return
    active = true
    createOverlay()
    document.addEventListener('mousemove', onMouseMove, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.body.style.cursor = 'crosshair'
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
  }

  function createOverlay() {
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
    overlay?.remove()
    label?.remove()
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

    // Label
    const tag = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ''
    const cls = el.classList.length ? `.${Array.from(el.classList).slice(0, 2).join('.')}` : ''
    const size = `${Math.round(rect.width)}×${Math.round(rect.height)}`
    label.textContent = `${tag}${id}${cls}  ${size}`

    // Position label above or below
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

    // Send to side panel
    chrome.runtime.sendMessage({ action: 'elementPicked', data })
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      stop()
      chrome.runtime.sendMessage({ action: 'inspectorCancelled' })
    }
  }

  function captureElement(el) {
    const rect = el.getBoundingClientRect()
    const computed = getComputedStyle(el)
    const tag = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ''
    const cls = el.classList.length ? `.${Array.from(el.classList).join('.')}` : ''

    // Key styles
    const styles = {}
    const props = [
      'display', 'position', 'width', 'height',
      'flex-direction', 'justify-content', 'align-items', 'gap',
      'grid-template-columns',
      'font-size', 'font-weight', 'color', 'background-color',
      'padding', 'margin', 'border', 'border-radius',
      'box-shadow', 'overflow', 'z-index', 'opacity',
    ]
    for (const p of props) {
      const v = computed.getPropertyValue(p)
      if (v && v !== 'none' && v !== 'auto' && v !== 'normal' &&
          v !== '0px' && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent') {
        styles[p] = v
      }
    }

    // Trimmed outer HTML (limit size)
    let html = el.outerHTML
    if (html.length > 3000) {
      html = html.slice(0, 3000) + '\n... (truncated)'
    }

    return {
      selector: `${tag}${id}${cls}`,
      tag,
      id: el.id || null,
      classes: Array.from(el.classList),
      size: { w: Math.round(rect.width), h: Math.round(rect.height) },
      position: { top: Math.round(rect.top), left: Math.round(rect.left) },
      styles,
      html,
      pageUrl: location.href,
    }
  }

  return { start, stop }
})()
