// Page Lens - Service Worker (minimal)

// Open Side Panel on icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return
  await chrome.sidePanel.open({ tabId: tab.id })
})

// Handle messages from Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startInspector' && message.tabId) {
    // Inject content scripts (safe to call multiple times)
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ['utils/dom-analyzer.js', 'utils/style-extractor.js', 'utils/layout-detector.js', 'content.js'],
    }).then(() => {
      // Wait a bit for scripts to init, then send message
      setTimeout(() => {
        chrome.tabs.sendMessage(message.tabId, { action: 'startInspector' }, (resp) => {
          if (chrome.runtime.lastError) {
            console.error('[page-lens]', chrome.runtime.lastError.message)
          }
        })
      }, 150)
    }).catch((err) => {
      console.error('[page-lens] inject failed:', err.message)
    })

    sendResponse({ ok: true })
    return false
  }
})
