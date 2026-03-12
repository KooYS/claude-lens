// Claude Lens - Content Script (Entry Point)
// Guard against double injection
if (window.__claudeLensLoaded) {
  // Already loaded — just re-register inspector availability
} else {
  window.__claudeLensLoaded = true;
}

console.log('[claude-lens] content script loaded');

// Register message handler (depends on: Inspector, DomAnalyzer, StyleExtractor, LayoutDetector, buildCssSelector, buildStructureTree)
registerMessageHandler();
