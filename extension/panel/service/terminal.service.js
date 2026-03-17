// eslint-disable-next-line no-unused-vars
class TerminalService {
  constructor(reconnectInterval) {
    this.reconnectInterval = reconnectInterval;
    this.url = null;
    this.ws = null;
    this.terminalView = null;
    this.statusView = null;
  }

  connect(url, terminalView, statusView) {
    this.url = url;
    this.terminalView = terminalView;
    this.statusView = statusView;
    this._disconnected = false;

    statusView.show('Connecting to server...');
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      statusView.hide();
      terminalView.focus();
      this.ws.send(
        JSON.stringify({ type: 'resize', cols: terminalView.cols, rows: terminalView.rows }),
      );
    };

    this.ws.onmessage = (event) => terminalView.write(event.data);

    this.ws.onclose = () => {
      if (this._disconnected) return;
      statusView.show('Disconnected. Reconnecting...', false);
      setTimeout(() => this.connect(this.url, terminalView, statusView), this.reconnectInterval);
    };

    this.ws.onerror = () => {
      statusView.show(
        'Cannot connect.\nnpm start --prefix ~/Desktop/dev/claude-lens/server',
        true,
      );
    };

    // Wire terminal events to WebSocket
    terminalView.onDataCallback = (data) => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(data);
    };

    terminalView.onResizeCallback = (cols, rows) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    };
  }

  disconnect() {
    this._disconnected = true;
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  inject(text) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'inject', text }));
    }
  }
}
