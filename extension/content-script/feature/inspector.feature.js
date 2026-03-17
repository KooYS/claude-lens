// eslint-disable-next-line no-unused-vars
var Inspector = (() => {
  let active = false;
  let overlay = null;
  let label = null;
  let hoveredEl = null;

  function start() {
    if (active) stop();
    active = true;
    createOverlay();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = 'crosshair';
    console.log('[claude-lens] inspector started');
  }

  function stop() {
    active = false;
    removeOverlay();
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    document.body.style.cursor = '';
    hoveredEl = null;
    console.log('[claude-lens] inspector stopped');
  }

  function createOverlay() {
    removeOverlay();
    overlay = document.createElement('div');
    overlay.id = '__claude-lens-overlay';
    overlay.style.cssText = `
      position: fixed; pointer-events: none; z-index: 2147483647;
      border: 2px solid #e07a3a; background: rgba(224,122,58,0.08);
      border-radius: 2px; transition: all 0.05s ease-out;
      display: none;
    `;

    label = document.createElement('div');
    label.id = '__claude-lens-label';
    label.style.cssText = `
      position: fixed; pointer-events: none; z-index: 2147483647;
      background: #431c07; color: #fed7aa; font-family: 'SF Mono', monospace;
      font-size: 11px; padding: 3px 8px; border-radius: 4px;
      white-space: nowrap; display: none; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    `;

    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(label);
  }

  function removeOverlay() {
    document.getElementById('__claude-lens-overlay')?.remove();
    document.getElementById('__claude-lens-label')?.remove();
    overlay = null;
    label = null;
  }

  function onMouseMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (
      !el ||
      el === overlay ||
      el === label ||
      el.id?.startsWith('__claude-lens')
    )
      return;
    hoveredEl = el;

    const rect = el.getBoundingClientRect();
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.display = 'block';

    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.classList.length
      ? `.${Array.from(el.classList).slice(0, 2).join('.')}`
      : '';
    const size = `${Math.round(rect.width)}\u00D7${Math.round(rect.height)}`;
    label.textContent = `${tag}${id}${cls}  ${size}`;

    const labelY = rect.top > 28 ? rect.top - 24 : rect.bottom + 4;
    label.style.top = labelY + 'px';
    label.style.left = Math.max(0, rect.left) + 'px';
    label.style.display = 'block';
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (!hoveredEl) return;

    const data = captureElement(hoveredEl);
    stop();

    chrome.storage.local.set({ pickedElement: data, pickedAt: Date.now() });
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      stop();
      chrome.storage.local.set({ pickedElement: null, pickedAt: Date.now() });
    }
  }

  function captureElement(el) {
    const lines = [];
    buildStructureTree(el, '', true, lines, 0, 4);

    return {
      pageUrl: location.href,
      tree: lines.join('\n'),
    };
  }

  return { start, stop };
})();
