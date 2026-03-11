// Page Lens - Content Script
// Handles messages from Side Panel, performs DOM analysis

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
})
