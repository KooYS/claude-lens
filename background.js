// Claude Lens - Service Worker
// Handles: side panel open, content script injection, network capture

// ── Network capture state ──
const networkCapture = {
  active: false,
  tabId: null,
  requests: new Map(),
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (source.tabId !== networkCapture.tabId) return

  if (method === 'Network.requestWillBeSent') {
    networkCapture.requests.set(params.requestId, {
      requestId: params.requestId,
      url: params.request.url,
      method: params.request.method,
      type: params.type,
      timestamp: params.timestamp,
      status: null,
      mimeType: null,
      size: null,
    })
  }

  if (method === 'Network.responseReceived') {
    const req = networkCapture.requests.get(params.requestId)
    if (req) {
      req.status = params.response.status
      req.mimeType = params.response.mimeType
      req.remoteAddress = params.response.remoteIPAddress
      req.responseHeaders = params.response.headers
    }
  }

  if (method === 'Network.loadingFinished') {
    const req = networkCapture.requests.get(params.requestId)
    if (req) {
      req.size = params.encodedDataLength
    }
  }
})

chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId === networkCapture.tabId) {
    networkCapture.active = false
    networkCapture.tabId = null
    console.log('[claude-lens] debugger detached:', reason)
  }
})

// ── Network capture handlers ──

async function handleNetworkStart(tabId) {
  // Detach previous if active
  if (networkCapture.active && networkCapture.tabId) {
    try { await chrome.debugger.detach({ tabId: networkCapture.tabId }) } catch {}
  }

  networkCapture.requests.clear()
  networkCapture.tabId = tabId

  await chrome.debugger.attach({ tabId }, '1.3')
  await chrome.debugger.sendCommand({ tabId }, 'Network.enable')
  networkCapture.active = true

  return { ok: true }
}

async function handleNetworkStop() {
  if (networkCapture.active && networkCapture.tabId) {
    try { await chrome.debugger.detach({ tabId: networkCapture.tabId }) } catch {}
    networkCapture.active = false
  }
  return { ok: true }
}

function handleNetworkGetRequests(filter = {}) {
  let requests = [...networkCapture.requests.values()]

  if (filter.type) {
    const types = filter.type.split(',')
    requests = requests.filter((r) => types.includes(r.type))
  }
  if (filter.urlPattern) {
    try {
      const re = new RegExp(filter.urlPattern, 'i')
      requests = requests.filter((r) => re.test(r.url))
    } catch {}
  }
  if (filter.statusCode) {
    requests = requests.filter((r) => r.status === filter.statusCode)
  }

  const limit = filter.limit || 200
  const truncated = requests.length > limit
  if (truncated) requests = requests.slice(-limit)

  return {
    capturing: networkCapture.active,
    total: networkCapture.requests.size,
    filtered: requests.length + (truncated ? ' (truncated)' : ''),
    requests,
  }
}

async function handleNetworkGetResponseBody(requestId) {
  if (!networkCapture.active || !networkCapture.tabId) {
    throw new Error('Network capture not active. Start capture first.')
  }

  const result = await chrome.debugger.sendCommand(
    { tabId: networkCapture.tabId },
    'Network.getResponseBody',
    { requestId },
  )
  return { body: result.body, base64Encoded: result.base64Encoded }
}

function handleNetworkClear() {
  networkCapture.requests.clear()
  return { ok: true }
}

// ── Side panel open ──

let sidePanelFallbackTimer = null

async function openPopupFallback(tab) {
  try {
    const win = await chrome.windows.get(tab.windowId)
    const width = 420
    await chrome.windows.create({
      url: chrome.runtime.getURL('sidepanel.html'),
      type: 'popup',
      width,
      height: win.height ?? 800,
      left: (win.left ?? 0) + (win.width ?? 1280) - width,
      top: win.top ?? 0,
    })
  } catch {
    chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') })
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return

  if (chrome.sidePanel) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id })
      // sidepanel.js가 실제로 로드되지 않으면 (Arc 등) 800ms 후 팝업으로 fallback
      sidePanelFallbackTimer = setTimeout(() => {
        console.warn('[claude-lens] sidePanel did not respond, opening popup fallback')
        openPopupFallback(tab)
      }, 800)
      return
    } catch (err) {
      console.warn('[claude-lens] sidePanel.open failed:', err.message)
    }
  }

  await openPopupFallback(tab)
})

// ── Message router ──

const CONTENT_SCRIPT_FILES = [
  'utils/dom-analyzer.js',
  'utils/style-extractor.js',
  'utils/layout-detector.js',
  'extension/content-script/util/selector.util.js',
  'extension/content-script/feature/tree-builder.feature.js',
  'extension/content-script/feature/inspector.feature.js',
  'extension/content-script/handler/message.handler.js',
  'content.js',
]

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ── Side panel ready (cancels popup fallback timer) ──
  if (message.action === 'sidePanelReady') {
    clearTimeout(sidePanelFallbackTimer)
    sidePanelFallbackTimer = null
    sendResponse({ ok: true })
    return false
  }

  // ── Inspector ──
  if (message.action === 'startInspector' && message.tabId) {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: CONTENT_SCRIPT_FILES,
    }).then(() => {
      setTimeout(() => {
        chrome.tabs.sendMessage(message.tabId, { action: 'startInspector' }, () => {
          if (chrome.runtime.lastError) console.warn('[claude-lens]', chrome.runtime.lastError.message)
        })
      }, 150)
    }).catch((err) => console.warn('[claude-lens] inject failed:', err.message))
    sendResponse({ ok: true })
    return false
  }

  if (message.action === 'stopInspector' && message.tabId) {
    chrome.tabs.sendMessage(message.tabId, { action: 'stopInspector' }, () => {
      if (chrome.runtime.lastError) console.warn('[claude-lens]', chrome.runtime.lastError.message)
    })
    sendResponse({ ok: true })
    return false
  }

  // ── Network capture ──
  if (message.action === 'networkStart' && message.tabId) {
    handleNetworkStart(message.tabId).then(sendResponse).catch((err) => sendResponse({ error: err.message }))
    return true
  }

  if (message.action === 'networkStop') {
    handleNetworkStop().then(sendResponse).catch((err) => sendResponse({ error: err.message }))
    return true
  }

  if (message.action === 'networkGetRequests') {
    try {
      sendResponse(handleNetworkGetRequests(message.filter))
    } catch (err) {
      sendResponse({ error: err.message })
    }
    return false
  }

  if (message.action === 'networkGetResponseBody' && message.requestId) {
    handleNetworkGetResponseBody(message.requestId).then(sendResponse).catch((err) => sendResponse({ error: err.message }))
    return true
  }

  if (message.action === 'networkClear') {
    sendResponse(handleNetworkClear())
    return false
  }

  // ── JS execution (CSP-safe, runs in MAIN world) ──
  if (message.action === 'evaluateJS' && message.tabId && message.code) {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      world: 'MAIN',
      func: (code) => {
        try { return { result: String(eval(code)) } }
        catch (e) { return { error: e.message } }
      },
      args: [message.code],
    }).then((results) => {
      sendResponse(results[0]?.result || { error: 'No result' })
    }).catch((err) => sendResponse({ error: err.message }))
    return true
  }

  // ── Content script relay ──
  if (message.action === 'queryTab' && message.tabId && message.query) {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: CONTENT_SCRIPT_FILES,
    }).catch(() => {})

    setTimeout(() => {
      chrome.tabs.sendMessage(message.tabId, message.query, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message })
        } else {
          sendResponse(response)
        }
      })
    }, 100)
    return true // async
  }
})
