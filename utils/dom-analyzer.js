// DOM Analyzer - Analyzes page structure and builds component tree

const DomAnalyzer = (() => {
  const SEMANTIC_TAGS = [
    'header', 'nav', 'main', 'section', 'article', 'aside', 'footer',
    'figure', 'figcaption', 'details', 'summary', 'dialog', 'form',
  ]

  const LANDMARK_ROLES = [
    'banner', 'navigation', 'main', 'complementary', 'contentinfo',
    'search', 'form', 'region',
  ]

  function getPageSummary() {
    const allElements = document.querySelectorAll('*')
    const totalElements = allElements.length

    // Semantic tag counts
    const semanticCounts = {}
    for (const tag of SEMANTIC_TAGS) {
      const count = document.querySelectorAll(tag).length
      if (count > 0) semanticCounts[tag] = count
    }

    // ARIA landmark roles
    const landmarkCounts = {}
    for (const role of LANDMARK_ROLES) {
      const count = document.querySelectorAll(`[role="${role}"]`).length
      if (count > 0) landmarkCounts[role] = count
    }

    // DOM depth
    const maxDepth = calculateMaxDepth(document.body, 0)

    // Tag distribution (top 10)
    const tagMap = {}
    allElements.forEach((el) => {
      const tag = el.tagName.toLowerCase()
      tagMap[tag] = (tagMap[tag] || 0) + 1
    })
    const topTags = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)

    // Technology detection
    const technologies = detectTechnologies()

    return {
      url: location.href,
      title: document.title,
      totalElements,
      maxDepth,
      semanticTags: semanticCounts,
      landmarkRoles: landmarkCounts,
      topTags,
      technologies,
      hasDoctype: document.doctype !== null,
      charset: document.characterSet,
      lang: document.documentElement.lang || null,
    }
  }

  function calculateMaxDepth(el, depth) {
    if (!el || depth > 50) return depth // safety limit
    let max = depth
    for (const child of el.children) {
      max = Math.max(max, calculateMaxDepth(child, depth + 1))
    }
    return max
  }

  function detectTechnologies() {
    const techs = []

    // Frameworks
    if (document.querySelector('[data-reactroot], [data-react-root], #__next'))
      techs.push('React')
    if (document.querySelector('[ng-version], [_nghost], [_ngcontent]'))
      techs.push('Angular')
    if (document.querySelector('[data-v-], [data-server-rendered]'))
      techs.push('Vue')
    if (document.querySelector('#svelte-announcer, [class*="svelte-"]'))
      techs.push('Svelte')
    if (document.getElementById('__nuxt'))
      techs.push('Nuxt')
    if (document.getElementById('__next'))
      techs.push('Next.js')
    if (document.getElementById('gatsby-focus-wrapper'))
      techs.push('Gatsby')

    // CSS Frameworks
    const allClasses = Array.from(document.querySelectorAll('[class]'))
      .flatMap((el) => Array.from(el.classList))
    const classSet = new Set(allClasses)

    if (allClasses.some((c) => /^(sm|md|lg|xl|2xl):/.test(c) || /^(flex|grid|p-|m-|text-|bg-)/.test(c)))
      techs.push('Tailwind CSS')
    if (classSet.has('container') && allClasses.some((c) => /^col-(xs|sm|md|lg)/.test(c)))
      techs.push('Bootstrap')
    if (document.querySelector('[class*="MuiBox"], [class*="MuiButton"]'))
      techs.push('MUI')
    if (document.querySelector('[class*="chakra-"]'))
      techs.push('Chakra UI')

    // Other
    if (document.querySelector('script[src*="jquery"], script[src*="jQuery"]') || typeof jQuery !== 'undefined')
      techs.push('jQuery')
    if (document.querySelector('link[href*="font-awesome"], svg.svg-inline--fa'))
      techs.push('Font Awesome')

    return techs
  }

  function buildComponentTree(maxDepth = 4) {
    return buildNode(document.body, 0, maxDepth)
  }

  function buildNode(el, depth, maxDepth) {
    if (!el || depth > maxDepth) return null

    const tag = el.tagName.toLowerCase()
    const isSemantic = SEMANTIC_TAGS.includes(tag)
    const role = el.getAttribute('role')
    const id = el.id || null
    const classList = Array.from(el.classList).slice(0, 3) // limit classes
    const childCount = el.children.length

    const node = {
      tag,
      id,
      classes: classList,
      role,
      isSemantic,
      childCount,
      children: [],
    }

    // For semantic/important elements, always recurse
    // For generic divs/spans, only recurse if depth allows and they have semantic children
    const shouldRecurse = depth < maxDepth
    if (shouldRecurse) {
      for (const child of el.children) {
        const childTag = child.tagName.toLowerCase()
        // Skip script, style, svg internals
        if (['script', 'style', 'noscript', 'link', 'meta'].includes(childTag)) continue

        const childNode = buildNode(child, depth + 1, maxDepth)
        if (childNode) {
          // Only include nodes that are semantic or have semantic descendants
          if (depth < 2 || childNode.isSemantic || childNode.children.length > 0 || childNode.role) {
            node.children.push(childNode)
          }
        }
      }

      // If too many children at shallow depth, keep only meaningful ones + count
      if (node.children.length > 10) {
        const meaningful = node.children.filter((c) => c.isSemantic || c.role || c.id)
        const rest = node.children.length - meaningful.length
        node.children = meaningful.length > 0 ? meaningful : node.children.slice(0, 5)
        node.truncated = rest
      }
    }

    return node
  }

  return { getPageSummary, buildComponentTree }
})()
