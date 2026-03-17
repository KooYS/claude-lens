// Claude Lens - Content Script (Entry Point)
// Guard against double injection
if (window.__claudeLensLoaded) {
  // Already loaded — skip re-registration
} else {
  window.__claudeLensLoaded = true;
  console.log('[claude-lens] content script loaded');
  if (typeof registerMessageHandler === 'function') {
    registerMessageHandler();
  }
}
