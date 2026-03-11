// Page Lens - Service Worker
// 1. Opens Side Panel on icon click
// 2. Maintains control WebSocket to relay page data requests from server

const CONTROL_URL = 'ws://localhost:19280/control'
const RECONNECT_INTERVAL = 5000

let controlWs = null
let reconnectTimer = null

// ── Side Panel ──

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  await chrome.sidePanel.open({ tabId: tab.id })
})

// ── Control WebSocket ──

function connectControl() {
  if (controlWs?.readyState === WebSocket.OPEN) return
  if (controlWs?.readyState === WebSocket.CONNECTING) return

  try {
    controlWs = new WebSocket(CONTROL_URL)
  } catch {
    scheduleReconnect()
    return
  }

  controlWs.onopen = () => {
    console.log('[page-lens] control connected')
  }

  controlWs.onmessage = async (event) => {
    let msg
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }

    if (!msg.id || !msg.action) return

    try {
      const result = await handleQuery(msg)
      controlWs.send(JSON.stringify({ id: msg.id, result }))
    } catch (err) {
      controlWs.send(JSON.stringify({ id: msg.id, error: err.message }))
    }
  }

  controlWs.onclose = () => {
    console.log('[page-lens] control disconnected')
    controlWs = null
    scheduleReconnect()
  }

  controlWs.onerror = () => {
    controlWs = null
    scheduleReconnect()
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectControl()
  }, RECONNECT_INTERVAL)
}

// ── Query Handler ──

async function handleQuery(msg) {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (!tab?.id) throw new Error('No active tab')

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Content script timeout')), 8000)

    chrome.tabs.sendMessage(tab.id, { action: msg.action, ...msg }, (response) => {
      clearTimeout(timeout)
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else if (response?.error) {
        reject(new Error(response.error))
      } else {
        resolve(response)
      }
    })
  })
}

// ── Boot ──

connectControl()

// Reconnect when service worker wakes up
chrome.runtime.onStartup.addListener(() => connectControl())
chrome.runtime.onInstalled.addListener(() => connectControl())
