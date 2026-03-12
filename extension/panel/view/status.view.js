// eslint-disable-next-line no-unused-vars
class StatusView {
  constructor(statusEl, terminalEl) {
    this.statusEl = statusEl;
    this.terminalEl = terminalEl;
    this.fitAddon = null;
  }

  setFitAddon(fitAddon) {
    this.fitAddon = fitAddon;
  }

  show(text, isError = false) {
    this.statusEl.textContent = text;
    this.statusEl.classList.add('visible');
    this.statusEl.classList.toggle('error', isError);
    this.terminalEl.style.display = 'none';
  }

  hide() {
    this.statusEl.classList.remove('visible');
    this.terminalEl.style.display = '';
    this.fitAddon?.fit();
  }
}
