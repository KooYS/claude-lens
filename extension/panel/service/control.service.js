// eslint-disable-next-line no-unused-vars
class ControlService {
  constructor(reconnectInterval) {
    this.reconnectInterval = reconnectInterval;
    this.url = null;
    this.ws = null;
  }

  connect(url) {
    this.url = url;
    this._disconnected = false;
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
        let result;
        if (msg.action.startsWith('network') || msg.action === 'evaluateJS') {
          result = await this.queryBackground(msg.action, msg);
        } else {
          result = await this.queryContentScript(msg.action, msg);
        }
        this.ws.send(JSON.stringify({ id: msg.id, result }));
      } catch (err) {
        this.ws.send(JSON.stringify({ id: msg.id, error: err.message }));
      }
    };

    this.ws.onclose = () => {
      if (this._disconnected) return;
      console.log('[claude-lens] control disconnected, reconnecting...');
      setTimeout(() => this.connect(this.url), this.reconnectInterval);
    };

    this.ws.onerror = () => {};
  }

  disconnect() {
    this._disconnected = true;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  async queryBackground(action, params) {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.id) throw new Error('No active tab');

    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action, tabId: tab.id, ...params },
        (response) => {
          if (chrome.runtime.lastError)
            reject(new Error(chrome.runtime.lastError.message));
          else if (response?.error) reject(new Error(response.error));
          else resolve(response);
        },
      );
    });
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
