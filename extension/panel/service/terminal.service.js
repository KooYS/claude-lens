// eslint-disable-next-line no-unused-vars
class TerminalService {
  constructor(url, reconnectInterval) {
    this.url = url;
    this.reconnectInterval = reconnectInterval;
    this.ws = null;
    this.terminalView = null;
    this.statusView = null;
  }

  connect(terminalView, statusView) {
    this.terminalView = terminalView;
    this.statusView = statusView;

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
      statusView.show('Disconnected. Reconnecting...', false);
      setTimeout(() => this.connect(terminalView, statusView), this.reconnectInterval);
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

  inject(text) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'inject', text }));
    }
  }
}
