// eslint-disable-next-line no-unused-vars
class PickerFeature {
  constructor(pickBtn, toolbarLabel) {
    this.pickBtn = pickBtn;
    this.toolbarLabel = toolbarLabel;
    this.picking = false;
    this.terminalService = null;
    this.terminalView = null;

    this.pickBtn.addEventListener('click', () => this.toggle());

    chrome.storage.onChanged.addListener((changes) => {
      if (changes.pickedElement && this.picking) {
        this.stopPicking();
        const data = changes.pickedElement.newValue;
        if (data) this.injectElementData(data);
      }
    });
  }

  setDependencies(terminalService, terminalView) {
    this.terminalService = terminalService;
    this.terminalView = terminalView;
  }

  async toggle() {
    if (this.picking) {
      this.stopPicking();
      return;
    }

    this.picking = true;
    this.pickBtn.classList.add('active');
    this.toolbarLabel.textContent = 'Pick an element...';

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      if (!tab?.id) throw new Error('No active tab');

      chrome.runtime.sendMessage(
        { action: 'startInspector', tabId: tab.id },
        (response) => {
          if (chrome.runtime.lastError || response?.error) {
            this.stopPicking();
            this.toolbarLabel.textContent = `Error: ${chrome.runtime.lastError?.message || response.error}`;
          }
        },
      );
    } catch (err) {
      this.stopPicking();
      this.toolbarLabel.textContent = `Error: ${err.message}`;
    }
  }

  stopPicking() {
    this.picking = false;
    this.pickBtn.classList.remove('active');
    this.toolbarLabel.textContent = 'Claude Lens';
  }

  injectElementData(data) {
    const text = `Here is the element structure from ${data.pageUrl}:\n\n${data.tree}\n`;
    this.terminalService?.inject(text);
    this.terminalView?.focus();
  }
}
