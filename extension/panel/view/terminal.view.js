// eslint-disable-next-line no-unused-vars
const TERMINAL_THEMES = {
  dark: {
    background: '#0a0a0c',
    foreground: '#d4d4d8',
    cursor: '#e07a3a',
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
  light: {
    background: '#fafafa',
    foreground: '#3f3f46',
    cursor: '#e07a3a',
    cursorAccent: '#fafafa',
    selectionBackground: '#d4d4d880',
    black: '#3f3f46',
    red: '#dc2626',
    green: '#16a34a',
    yellow: '#ca8a04',
    blue: '#2563eb',
    magenta: '#7c3aed',
    cyan: '#0891b2',
    white: '#f4f4f5',
    brightBlack: '#71717a',
    brightRed: '#ef4444',
    brightGreen: '#22c55e',
    brightYellow: '#eab308',
    brightBlue: '#3b82f6',
    brightMagenta: '#8b5cf6',
    brightCyan: '#06b6d4',
    brightWhite: '#ffffff',
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    cursorAccent: '#272822',
    selectionBackground: '#49483e80',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5',
  },
  dracula: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selectionBackground: '#44475a80',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
};

// eslint-disable-next-line no-unused-vars
class TerminalView {
  constructor(terminalEl) {
    this.terminalEl = terminalEl;
    this.term = null;
    this.fitAddon = null;
    this.onDataCallback = null;
    this.onResizeCallback = null;
    this._resizeObserver = null;
  }

  init(options = {}) {
    // Clean up previous instance if any
    this.dispose();

    const fontSize = options.fontSize || 13;
    const themeName = options.theme || 'dark';
    const theme = TERMINAL_THEMES[themeName] || TERMINAL_THEMES.dark;

    this.term = new Terminal({
      fontSize,
      fontFamily:
        "'SF Mono', 'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
      theme,
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

    this._resizeObserver = new ResizeObserver(() => {
      if (this.fitAddon) this.fitAddon.fit();
    });
    this._resizeObserver.observe(this.terminalEl);
  }

  write(data) {
    this.term?.write(data);
  }

  focus() {
    this.term?.focus();
  }

  get cols() {
    return this.term?.cols;
  }

  get rows() {
    return this.term?.rows;
  }

  dispose() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this.term) {
      this.term.dispose();
      this.term = null;
      this.fitAddon = null;
      this.onDataCallback = null;
      this.onResizeCallback = null;
    }
  }
}
