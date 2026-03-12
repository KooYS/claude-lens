// eslint-disable-next-line no-unused-vars
class ControlService {
  constructor(url, reconnectInterval) {
    this.url = url;
    this.reconnectInterval = reconnectInterval;
    this.ws = null;
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => console.log('[claude-lens] control connected');

    this.ws.onmessage = async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!msg.id || !msg.action) return;

      try {
        const result = await this.queryContentScript(msg.action, msg);
        this.ws.send(JSON.stringify({ id: msg.id, result }));
      } catch (err) {
        this.ws.send(JSON.stringify({ id: msg.id, error: err.message }));
      }
    };

    this.ws.onclose = () => {
      console.log('[claude-lens] control disconnected, reconnecting...');
      setTimeout(() => this.connect(), this.reconnectInterval);
    };

    this.ws.onerror = () => {};
  }

  async queryContentScript(action, params) {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.id) throw new Error('No active tab');

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'queryTab', tabId: tab.id, query: { action, ...params } },
        (response) => {
          if (chrome.runtime.lastError)
            reject(new Error(chrome.runtime.lastError.message));
          else if (response?.error) reject(new Error(response.error));
          else resolve(response);
        },
      );
    });
  }
}
