// Claude Lens - Service Worker (minimal)
// Only handles: side panel open + content script injection

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  await chrome.sidePanel.open({ tabId: tab.id })
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startInspector' && message.tabId) {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ['utils/dom-analyzer.js', 'utils/style-extractor.js', 'utils/layout-detector.js', 'content.js'],
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

  // Relay content script queries from side panel
  if (message.action === 'queryTab' && message.tabId && message.query) {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ['utils/dom-analyzer.js', 'utils/style-extractor.js', 'utils/layout-detector.js', 'content.js'],
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
