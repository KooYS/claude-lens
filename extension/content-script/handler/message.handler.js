// eslint-disable-next-line no-unused-vars
function registerMessageHandler() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const action = message.action;

    if (action === 'ping') {
      sendResponse({ ok: true });
      return;
    }

    if (action === 'startInspector') {
      Inspector.start();
      sendResponse({ ok: true });
      return;
    }

    if (action === 'stopInspector') {
      Inspector.stop();
      sendResponse({ ok: true });
      return;
    }

    if (action === 'analyzePage') {
      try {
        const summary = DomAnalyzer.getPageSummary();
        const tree = DomAnalyzer.buildComponentTree(message.depth || 4);
        sendResponse({ summary, tree });
      } catch (err) {
        sendResponse({ error: err.message });
      }
      return;
    }

    if (action === 'getElementInfo') {
      try {
        const info = StyleExtractor.getElementInfo(message.selector);
        sendResponse({ info });
      } catch (err) {
        sendResponse({ error: err.message });
      }
      return;
    }

    if (action === 'detectLayouts') {
      try {
        const layouts = LayoutDetector.detectLayouts();
        sendResponse({ layouts });
      } catch (err) {
        sendResponse({ error: err.message });
      }
      return;
    }

    if (action === 'getOuterHTML') {
      try {
        const selector = message.selector || 'body';
        const el = document.querySelector(selector);
        if (!el) sendResponse({ error: `Element not found: ${selector}` });
        else sendResponse({ html: el.outerHTML });
      } catch (err) {
        sendResponse({ error: err.message });
      }
      return;
    }

    if (action === 'evaluateJS') {
      try {
        const result = new Function(message.code)();
        sendResponse({ result: String(result) });
      } catch (err) {
        sendResponse({ error: err.message });
      }
      return;
    }

    if (action === 'getPageInfo') {
      sendResponse({
        url: location.href,
        title: document.title,
        lang: document.documentElement.lang,
        readyState: document.readyState,
      });
      return;
    }

    if (action === 'getInputValues') {
      try {
        const inputs = Array.from(
          document.querySelectorAll('input, textarea, select'),
        );
        const values = inputs
          .filter((el) => el.value)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            type: el.type || null,
            name: el.name || null,
            id: el.id || null,
            placeholder: el.placeholder || null,
            value: el.value.slice(0, 200),
            selector: buildCssSelector(el),
          }));
        sendResponse({ values });
      } catch (err) {
        sendResponse({ error: err.message });
      }
      return;
    }

    if (action === 'getVisibleText') {
      try {
        const selector = message.selector || 'body';
        const el = document.querySelector(selector);
        if (!el) {
          sendResponse({ error: `Not found: ${selector}` });
          return;
        }
        const text = el.innerText?.slice(0, message.maxLength || 2000) || '';
        sendResponse({ text });
      } catch (err) {
        sendResponse({ error: err.message });
      }
      return;
    }
  });
}
