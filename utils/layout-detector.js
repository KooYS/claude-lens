// Layout Detector - Detects flex/grid layout patterns

var LayoutDetector = (() => {
  function detectLayouts() {
    const layouts = { flex: [], grid: [] }

    const allElements = document.querySelectorAll('*')
    for (const el of allElements) {
      const computed = getComputedStyle(el)
      const display = computed.display

      if (display === 'flex' || display === 'inline-flex') {
        layouts.flex.push(summarizeFlexContainer(el, computed))
      } else if (display === 'grid' || display === 'inline-grid') {
        layouts.grid.push(summarizeGridContainer(el, computed))
      }
    }

    // Limit to top 20 most relevant
    layouts.flex = layouts.flex.slice(0, 20)
    layouts.grid = layouts.grid.slice(0, 20)

    return {
      flexCount: layouts.flex.length,
      gridCount: layouts.grid.length,
      flex: layouts.flex,
      grid: layouts.grid,
    }
  }

  function summarizeFlexContainer(el, computed) {
    return {
      selector: getShortSelector(el),
      direction: computed.flexDirection,
      justifyContent: computed.justifyContent,
      alignItems: computed.alignItems,
      wrap: computed.flexWrap,
      gap: computed.gap,
      childCount: el.childElementCount,
    }
  }

  function summarizeGridContainer(el, computed) {
    return {
      selector: getShortSelector(el),
      columns: computed.gridTemplateColumns,
      rows: computed.gridTemplateRows,
      gap: computed.gap,
      childCount: el.childElementCount,
    }
  }

  function getShortSelector(el) {
    const tag = el.tagName.toLowerCase()
    if (el.id) return `${tag}#${el.id}`
    if (el.classList.length > 0) return `${tag}.${Array.from(el.classList).slice(0, 2).join('.')}`
    return tag
  }

  return { detectLayouts }
})()
