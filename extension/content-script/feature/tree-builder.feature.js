// eslint-disable-next-line no-unused-vars
function buildStructureTree(el, prefix, isLast, lines, depth, maxDepth) {
  if (!el || depth > maxDepth) return;

  const tag = el.tagName.toLowerCase();
  if (
    ['script', 'style', 'noscript', 'link', 'meta', 'br', 'hr'].includes(tag)
  )
    return;

  const id = el.id ? `#${el.id}` : '';
  const cls = el.classList.length
    ? `.${Array.from(el.classList).slice(0, 3).join('.')}`
    : '';
  const rect = el.getBoundingClientRect();
  const computed = getComputedStyle(el);

  // Size
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  const size = w || h ? `${w}\u00D7${h}` : '';

  // Layout hints (only meaningful ones)
  const hints = [];
  const display = computed.display;
  if (display === 'flex' || display === 'inline-flex') {
    const dir = computed.flexDirection;
    const justify = computed.justifyContent;
    const align = computed.alignItems;
    let flex = `flex`;
    if (dir !== 'row') flex += ` ${dir}`;
    if (justify !== 'normal' && justify !== 'flex-start')
      flex += ` ${justify}`;
    if (align !== 'normal' && align !== 'stretch') flex += ` align:${align}`;
    const gap = computed.gap;
    if (gap && gap !== 'normal' && gap !== '0px') flex += ` gap:${gap}`;
    hints.push(flex);
  } else if (display === 'grid' || display === 'inline-grid') {
    const cols = computed.gridTemplateColumns;
    const colCount = cols.split(/\s+/).length;
    hints.push(`grid ${colCount}col`);
  } else if (display !== 'block' && display !== 'inline' && display !== '') {
    hints.push(display);
  }

  if (computed.position !== 'static') hints.push(`pos:${computed.position}`);
  if (computed.overflow !== 'visible')
    hints.push(`overflow:${computed.overflow}`);

  // Key attributes for non-div elements
  const attrs = [];
  if (tag === 'a')
    attrs.push(`href="${(el.getAttribute('href') || '').slice(0, 50)}"`);
  if (tag === 'img')
    attrs.push(`src="${(el.getAttribute('src') || '').slice(0, 50)}"`);
  if (tag === 'input') attrs.push(`type="${el.type}"`);
  if (el.getAttribute('role'))
    attrs.push(`role="${el.getAttribute('role')}"`);
  if (el.getAttribute('aria-label'))
    attrs.push(`aria="${el.getAttribute('aria-label').slice(0, 30)}"`);

  // Text content (leaf nodes only, short)
  let text = '';
  if (el.childElementCount === 0 && el.textContent?.trim()) {
    const t = el.textContent.trim();
    if (t.length <= 40) text = ` "${t}"`;
    else text = ` "${t.slice(0, 37)}..."`;
  }

  // Build line
  const connector =
    prefix === '' ? '' : isLast ? '\u2514\u2500 ' : '\u251C\u2500 ';
  const meta = [size, ...hints, ...attrs].filter(Boolean).join(' | ');
  const metaStr = meta ? ` ${meta}` : '';
  lines.push(`${prefix}${connector}<${tag}${id}${cls}>${metaStr}${text}`);

  // Children
  const children = Array.from(el.children).filter((c) => {
    const t = c.tagName.toLowerCase();
    return ![
      'script',
      'style',
      'noscript',
      'link',
      'meta',
      'br',
      'hr',
    ].includes(t);
  });

  // If too many similar children, collapse
  if (children.length > 8) {
    const groups = {};
    for (const c of children) {
      const key =
        c.tagName.toLowerCase() + (c.className ? `.${c.classList[0]}` : '');
      groups[key] = (groups[key] || 0) + 1;
    }

    const nextPrefix =
      prefix === '' ? '' : prefix + (isLast ? '   ' : '\u2502  ');
    for (let i = 0; i < Math.min(3, children.length); i++) {
      buildStructureTree(
        children[i],
        nextPrefix,
        i === 2 && children.length <= 3,
        lines,
        depth + 1,
        maxDepth,
      );
    }
    if (children.length > 3) {
      const summary = Object.entries(groups)
        .map(([k, v]) => `<${k}>\u00D7${v}`)
        .join(', ');
      lines.push(
        `${nextPrefix}\u2514\u2500 ... ${children.length} children: ${summary}`,
      );
    }
    return;
  }

  const nextPrefix =
    prefix === '' ? '' : prefix + (isLast ? '   ' : '\u2502  ');
  for (let i = 0; i < children.length; i++) {
    buildStructureTree(
      children[i],
      nextPrefix,
      i === children.length - 1,
      lines,
      depth + 1,
      maxDepth,
    );
  }
}
