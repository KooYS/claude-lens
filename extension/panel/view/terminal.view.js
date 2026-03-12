// eslint-disable-next-line no-unused-vars
class TerminalView {
  constructor(terminalEl) {
    this.terminalEl = terminalEl;
    this.term = null;
    this.fitAddon = null;
    this.onDataCallback = null;
    this.onResizeCallback = null;
  }

  init() {
    this.term = new Terminal({
      fontSize: 13,
      fontFamily:
        "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
      theme: {
        background: '#0a0a0c',
        foreground: '#d4d4d8',
        cursor: '#a78bfa',
        cursorAccent: '#0a0a0c',
        selectionBackground: '#27272a80',
        black: '#18181b',
        red: '#f87171',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#a78bfa',
        cyan: '#22d3ee',
        white: '#d4d4d8',
        brightBlack: '#52525b',
        brightRed: '#fca5a5',
        brightGreen: '#6ee7b7',
        brightYellow: '#fde68a',
        brightBlue: '#93c5fd',
        brightMagenta: '#c4b5fd',
        brightCyan: '#67e8f9',
        brightWhite: '#f4f4f5',
      },
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
    });

    this.fitAddon = new FitAddon.FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.open(this.terminalEl);
    this.fitAddon.fit();

    this.term.onData((data) => {
      this.onDataCallback?.(data);
    });

    this.term.onResize(({ cols, rows }) => {
      this.onResizeCallback?.(cols, rows);
    });

    new ResizeObserver(() => this.fitAddon.fit()).observe(this.terminalEl);
  }

  write(data) {
    this.term.write(data);
  }

  focus() {
    this.term.focus();
  }

  get cols() {
    return this.term.cols;
  }

  get rows() {
    return this.term.rows;
  }
}
