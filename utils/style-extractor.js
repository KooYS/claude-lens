// Style Extractor - Extracts computed styles for selected elements

var StyleExtractor = (() => {
  const KEY_PROPERTIES = [
    'display', 'position', 'width', 'height',
    'margin', 'padding', 'border',
    'font-family', 'font-size', 'font-weight', 'line-height', 'color',
    'background-color', 'background-image',
    'flex-direction', 'justify-content', 'align-items', 'gap',
    'grid-template-columns', 'grid-template-rows',
    'overflow', 'z-index', 'opacity',
    'box-shadow', 'border-radius',
  ]

  function getElementInfo(selector) {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector
    if (!el) return null

    const computed = getComputedStyle(el)
    const rect = el.getBoundingClientRect()

    const styles = {}
    for (const prop of KEY_PROPERTIES) {
      const val = computed.getPropertyValue(prop)
      // Skip default/empty values
      if (val && val !== 'none' && val !== 'auto' && val !== 'normal'
        && val !== '0px' && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
        styles[prop] = val
      }
    }

    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: Array.from(el.classList),
      attributes: getKeyAttributes(el),
      dimensions: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      },
      styles,
      textContent: el.textContent?.trim().slice(0, 100) || null,
      childElementCount: el.childElementCount,
    }
  }

  function getKeyAttributes(el) {
    const skip = new Set(['class', 'id', 'style'])
    const attrs = {}
    for (const attr of el.attributes) {
      if (skip.has(attr.name)) continue
      if (attr.name.startsWith('data-') || ['role', 'aria-label', 'href', 'src', 'alt', 'type', 'name'].includes(attr.name)) {
        attrs[attr.name] = attr.value.slice(0, 80)
      }
    }
    return attrs
  }

  return { getElementInfo }
})()
