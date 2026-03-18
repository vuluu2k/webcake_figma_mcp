import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { COMPONENT_MAP, CATEGORIES, mapFigmaToComponents } from './component-map.js'

const FIGMA_API = 'https://api.figma.com/v1'
const token = process.env.FIGMA_ACCESS_TOKEN
if (!token) {
  console.error('FIGMA_ACCESS_TOKEN is required. Get one at https://www.figma.com/developers/api#access-tokens')
  process.exit(1)
}

async function figmaFetch(path, retries = 0) {
  const res = await fetch(`${FIGMA_API}${path}`, { headers: { 'X-Figma-Token': token } })
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 429 && retries < 3) {
      await new Promise((r) => setTimeout(r, (retries + 1) * 2000))
      return figmaFetch(path, retries + 1)
    }
    throw new Error(`Figma API ${res.status}: ${body}`)
  }
  return res.json()
}

function parseUrl(input) {
  const fileKey = input.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/)?.[1] || input.split(/[/?]/)[0]
  const raw = input.match(/node-id=([^&]+)/)?.[1]
  return { fileKey, nodeId: raw ? decodeURIComponent(raw).replaceAll('-', ':') : null }
}

function resolveId(figma_url, node_id) {
  const { fileKey, nodeId } = parseUrl(figma_url)
  return { fileKey, nodeId: node_id?.replaceAll('-', ':') || nodeId }
}

async function fetchNode(fileKey, nodeId, depth = 15) {
  if (nodeId) {
    const data = await figmaFetch(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&depth=${depth}`)
    return data.nodes?.[nodeId]?.document || null
  }
  const data = await figmaFetch(`/files/${fileKey}?depth=${depth}`)
  return data.document
}

async function fetchScreenshot(fileKey, nodeId, scale = 1) {
  for (let s = scale; s >= 0.5; s = s > 1 ? s - 1 : s * 0.5) {
    try {
      const data = await figmaFetch(`/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&scale=${s}&format=png`)
      const url = data.images?.[nodeId]
      if (url) return { url, scale: s }
    } catch (e) {
      if (e.message.includes('timeout') || e.message.includes('Render timeout')) continue
      throw e
    }
  }
  return null
}

const txt = (text) => ({ content: [{ type: 'text', text }] })
const json = (obj) => txt(JSON.stringify(obj, null, 2))

function hex(c, opacity) {
  if (!c) return undefined
  const r = (c.r * 255) | 0, g = (c.g * 255) | 0, b = (c.b * 255) | 0
  const a = opacity ?? c.a ?? 1
  return a < 1 ? `rgba(${r},${g},${b},${a.toFixed(2)})` : `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

// ===== Simplify node =====
function simplify(node) {
  const r = { id: node.id, name: node.name, type: node.type }
  if (node.absoluteBoundingBox) {
    const b = node.absoluteBoundingBox
    r.bounds = { x: b.x | 0, y: b.y | 0, w: b.width | 0, h: b.height | 0 }
  }
  if (node.layoutMode) {
    r.layout = {
      mode: node.layoutMode, gap: node.itemSpacing,
      padding: [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft],
      align: node.primaryAxisAlignItems, cross: node.counterAxisAlignItems,
    }
  }
  const fills = node.fills?.filter((f) => f.visible !== false)
  if (fills?.length) {
    r.fills = fills.map((f) =>
      f.type === 'SOLID' ? { type: 'solid', color: hex(f.color, f.opacity) }
        : f.type === 'IMAGE' ? { type: 'image', ref: f.imageRef }
          : { type: f.type },
    )
  }
  const strokes = node.strokes?.filter((s) => s.visible !== false)
  if (strokes?.length) r.strokes = strokes.map((s) => ({ color: hex(s.color, s.opacity), w: node.strokeWeight }))
  if (node.cornerRadius) r.radius = node.cornerRadius
  else if (node.rectangleCornerRadii) r.radius = node.rectangleCornerRadii
  const fx = node.effects?.filter((e) => e.visible !== false)
  if (fx?.length) r.effects = fx.map((e) => ({ type: e.type, color: e.color ? hex(e.color) : undefined, offset: e.offset, radius: e.radius }))
  if (node.type === 'TEXT') {
    const s = node.style || {}
    r.text = { chars: node.characters, size: s.fontSize, family: s.fontFamily, weight: s.fontWeight, align: s.textAlignHorizontal }
  }
  if (node.componentId) r.componentId = node.componentId
  if (node.componentProperties) r.compProps = node.componentProperties
  if (node.children) {
    const visible = node.children.filter((c) => c.visible !== false)
    if (visible.length) r.children = visible.map(simplify)
  }
  return r
}

// text-design SCSS class mapping (from src/style/view/design/text_design.scss)
// Levels: h0(48px) h1(38px) h2(30px) h3(24px) h4(20px) h5(16px) body(14px) body-sm(13px) footnote(12px) footnote-sm(10px)
// Weights: light(300) regular(400) medium(500) semibold(600) bold(700)
const TD_LEVELS = [[48, 'h0'], [38, 'h1'], [30, 'h2'], [24, 'h3'], [20, 'h4'], [16, 'h5'], [14, 'body'], [13, 'body-sm'], [12, 'footnote'], [0, 'footnote-sm']]
const TD_WEIGHTS = [[700, 'bold'], [600, 'semibold'], [500, 'medium'], [400, 'regular'], [300, 'light']]

function textDesignClass(fontSize, fontWeight) {
  let level = 'body'
  if (fontSize) {
    for (const [min, name] of TD_LEVELS) {
      if (fontSize >= min) { level = name; break }
    }
  }
  let weight = 'regular'
  if (fontWeight) {
    for (const [min, name] of TD_WEIGHTS) {
      if (fontWeight >= min) { weight = name; break }
    }
  }
  return `text-design-${level}-${weight}`
}

// ===== Design context: structured description for LLM =====
function describeNode(node, parentBounds, depth = 0) {
  const indent = '  '.repeat(depth)
  const lines = []
  const b = node.absoluteBoundingBox
  const w = b ? Math.round(b.width) : 0
  const h = b ? Math.round(b.height) : 0

  // Skip decorative/illustration elements
  if (isDecorative(node)) {
    lines.push(`${indent}[decorative] ${node.type} "${node.name}" ${w}x${h} (skip)`)
    return lines
  }
  // Skip individual vectors (part of illustrations) — only keep if they have image fills
  if (node.type === 'VECTOR' && !node.fills?.some((f) => f.visible !== false && f.type === 'IMAGE')) {
    return lines
  }

  // Position relative to parent
  let pos = ''
  if (b && parentBounds) {
    const relX = Math.round(b.x - parentBounds.x)
    const relY = Math.round(b.y - parentBounds.y)
    pos = ` at (${relX}, ${relY})`
  }

  // LINE → Divider
  if (node.type === 'LINE') {
    lines.push(`${indent}LINE "${node.name}" ${w}x${h}${pos} → <Divider />`)
    return lines
  }

  // Basic info
  let desc = `${indent}${node.type} "${node.name}" ${w}x${h}${pos}`

  // Layout info
  if (node.layoutMode) {
    desc += ` [${node.layoutMode === 'HORIZONTAL' ? 'row' : 'col'}`
    if (node.itemSpacing) desc += ` gap:${Math.round(node.itemSpacing)}`
    const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].filter(Boolean)
    if (pad.length) desc += ` pad:${pad.map(Math.round).join(',')}`
    if (node.primaryAxisAlignItems) desc += ` align:${node.primaryAxisAlignItems}`
    if (node.counterAxisAlignItems) desc += ` cross:${node.counterAxisAlignItems}`
    desc += ']'
  }

  // Visual properties
  const fills = node.fills?.filter((f) => f.visible !== false) || []
  for (const f of fills) {
    if (f.type === 'SOLID') desc += ` bg:${hex(f.color, f.opacity)}`
    else if (f.type === 'IMAGE') desc += ` img:${f.imageRef?.slice(0, 12)}...`
    else if (f.type?.includes('GRADIENT')) desc += ` gradient`
  }
  const strokes = node.strokes?.filter((s) => s.visible !== false) || []
  if (strokes.length) desc += ` border:${hex(strokes[0].color)}/${node.strokeWeight}px`
  if (node.cornerRadius) desc += ` rounded:${node.cornerRadius}px`
  if (node.effects?.some((e) => e.visible !== false && e.type === 'DROP_SHADOW')) desc += ` shadow`
  if (node.opacity != null && node.opacity < 1) desc += ` opacity:${node.opacity}`
  if (node.clipsContent) desc += ` clip`

  // Text — output text-design class
  if (node.type === 'TEXT' && node.characters) {
    const s = node.style || {}
    const tdClass = textDesignClass(s.fontSize, s.fontWeight)
    desc += ` "${node.characters}" ${tdClass}`
    desc += ` (${s.fontFamily}/${s.fontSize}px/${s.fontWeight})`
    if (s.textAlignHorizontal && s.textAlignHorizontal !== 'LEFT') desc += ` align:${s.textAlignHorizontal}`
    const textFill = fills.find((f) => f.type === 'SOLID')
    if (textFill) desc += ` color:${hex(textFill.color, textFill.opacity)}`
  }

  // Component match
  const compMatch = matchVueComponent(node)
  if (compMatch) desc += ` → <${compMatch}>`

  lines.push(desc)

  // Children
  if (node.children) {
    for (const child of node.children) {
      if (child.visible === false) continue
      lines.push(...describeNode(child, b, depth + 1))
    }
  }
  return lines
}

function isDecorative(node) {
  // Ellipses/shapes with blur effects = decorative background
  if (['ELLIPSE'].includes(node.type)) {
    const hasBlur = node.effects?.some((e) => e.visible !== false && (e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR'))
    if (hasBlur) return true
  }
  // Groups full of vectors = illustration/decoration (maps, complex SVG art)
  if (node.type === 'GROUP' && node.children) {
    const kids = node.children.filter((c) => c.visible !== false)
    const vectors = kids.filter((c) => c.type === 'VECTOR' || (c.type === 'GROUP' && isVectorGroup(c)))
    if (kids.length > 5 && vectors.length > kids.length * 0.7) return true
    // Empty groups
    const meaningful = kids.filter((c) => !isDecorative(c))
    if (meaningful.length === 0) return true
  }
  return false
}

function isVectorGroup(node) {
  if (!node.children) return false
  const kids = node.children.filter((c) => c.visible !== false)
  return kids.length > 0 && kids.every((c) => c.type === 'VECTOR' || (c.type === 'GROUP' && isVectorGroup(c)))
}

function matchVueComponent(node) {
  // Quick match using the same rules as component-map
  const name = node.name || ''
  const n = name.toLowerCase()
  if (/button/i.test(n) && !/radio|checkbox|switch|toggle/i.test(n)) return 'Button'
  if (/sidebar/i.test(n)) return 'Sidebar'
  if (/checkbox/i.test(n)) return 'Checkbox'
  if (/dropdown/i.test(n)) return 'Dropdown'
  if (/avatar/i.test(n)) return 'Avatar'
  if (/badge/i.test(n)) return 'Badge'
  if (/modal|dialog/i.test(n)) return 'Modal'
  if (/table/i.test(n) && node.type === 'FRAME') return 'Table'
  if (/tabs|tab.?bar/i.test(n)) return 'Tabs'
  if (/switch|toggle/i.test(n)) return 'Switch'
  if (/select|combobox/i.test(n) && !/date|tree/i.test(n)) return 'Select'
  if (/input|text.?field/i.test(n) && !/search/i.test(n)) return 'Input'
  if (/search/i.test(n)) return 'InputSearch'
  if (/alert|banner/i.test(n)) return 'Alert'
  if (/tag|chip/i.test(n) && !/input/i.test(n)) return 'Tags'
  if (/pagination/i.test(n)) return 'Pagination'
  if (/drawer/i.test(n)) return 'Drawer'
  if (/image|photo|picture/i.test(n) && !/upload/i.test(n)) return 'Image'
  return null
}

function collectAllText(node, results = []) {
  if (node.type === 'TEXT' && node.characters && node.visible !== false) {
    const s = node.style || {}
    results.push({
      text: node.characters,
      font: s.fontFamily, size: s.fontSize, weight: s.fontWeight,
      color: node.fills?.find((f) => f.type === 'SOLID' && f.visible !== false)?.color ? hex(node.fills.find((f) => f.type === 'SOLID').color) : null,
    })
  }
  if (node.children) {
    for (const child of node.children) {
      if (child.visible !== false) collectAllText(child, results)
    }
  }
  return results
}

function collectAllImages(node, parentBounds, results = []) {
  const fills = node.fills?.filter((f) => f.visible !== false && f.type === 'IMAGE') || []
  if (fills.length && node.absoluteBoundingBox) {
    const b = node.absoluteBoundingBox
    results.push({
      ref: fills[0].imageRef,
      name: node.name,
      w: Math.round(b.width), h: Math.round(b.height),
      x: parentBounds ? Math.round(b.x - parentBounds.x) : 0,
      y: parentBounds ? Math.round(b.y - parentBounds.y) : 0,
    })
  }
  if (node.children) {
    for (const child of node.children) {
      if (child.visible !== false) collectAllImages(child, parentBounds || node.absoluteBoundingBox, results)
    }
  }
  return results
}

// ===== MCP Server =====
const server = new McpServer({
  name: 'figma-vue',
  version: '2.0.0',
  description: 'Figma → Vue 3 MCP using @/components/design/',
})

const urlParam = z.string().describe('Figma URL or file key')
const nodeParam = z.string().optional().describe('Node ID (e.g. "1:2" or "1-2"), optional if in URL')

// ---------- MAIN TOOL: get_design_context ----------
server.tool('get_design_context',
  `Fetch complete design context from Figma for implementing in Vue 3. Returns:
- Screenshot URL for visual reference
- Structured tree description with positions, styles, text, colors
- Vue component mapping (which elements map to @/components/design/)
- All text content with font info
- All image assets with refs
USE THIS TOOL FIRST when implementing a Figma design.`,
  {
    figma_url: urlParam, node_id: nodeParam,
  },
  async ({ figma_url, node_id }) => {
    const { fileKey, nodeId } = resolveId(figma_url, node_id)
    const doc = await fetchNode(fileKey, nodeId)
    if (!doc) return txt('Node not found')

    // Get screenshot
    const screenshot = nodeId ? await fetchScreenshot(fileKey, nodeId).catch(() => null) : null

    // Tree description
    const tree = describeNode(doc, null)

    // Component matches
    const matches = mapFigmaToComponents(doc)
    const imports = [...new Set(matches.map((m) => COMPONENT_MAP[m.comp]?.import).filter(Boolean))]

    // All text
    const texts = collectAllText(doc)

    // All images — collect refs then batch-resolve URLs
    const images = collectAllImages(doc, doc.absoluteBoundingBox)
    let imageUrlMap = {}
    if (images.length) {
      try {
        const imgData = await figmaFetch(`/files/${fileKey}/images`)
        imageUrlMap = imgData.meta?.images || {}
      } catch (_) { /* non-critical */ }
    }

    // Root info
    const b = doc.absoluteBoundingBox
    const rootW = b ? Math.round(b.width) : 0
    const rootH = b ? Math.round(b.height) : 0

    let output = `# Design Context: ${doc.name}\n`
    output += `Size: ${rootW}x${rootH}px\n`
    if (screenshot) output += `Screenshot: ${screenshot.url}\n`
    output += `\n`

    output += `## Element Tree\n`
    output += `(format: TYPE "name" WxH at(x,y) [layout] styles → <VueComponent>)\n\n`
    output += tree.join('\n') + '\n\n'

    if (matches.length) {
      output += `## Vue Component Mapping (${matches.length} matches)\n\n`
      // Deduplicate by component
      const byComp = {}
      for (const m of matches) {
        if (!byComp[m.comp]) byComp[m.comp] = []
        byComp[m.comp].push(m.name)
      }
      for (const [comp, nodes] of Object.entries(byComp)) {
        const c = COMPONENT_MAP[comp]
        output += `### ${comp} (${nodes.length}x)\n`
        output += `Import: ${c?.import}\n`
        output += `Example: ${c?.ex}\n`
        if (c?.props) output += `Props: ${Object.entries(c.props).map(([k, v]) => `${k}:${v.type}${v.options ? `[${v.options}]` : ''}`).join(', ')}\n`
        if (c?.slots?.length) output += `Slots: ${c.slots.join(', ')}\n`
        output += `Nodes: ${nodes.slice(0, 5).join(', ')}${nodes.length > 5 ? ` (+${nodes.length - 5} more)` : ''}\n\n`
      }
      output += `All imports:\n${imports.join('\n')}\n\n`
    }

    if (texts.length) {
      output += `## Text Content (${texts.length} elements)\n\n`
      for (const t of texts) {
        const cls = textDesignClass(t.size, t.weight)
        output += `- "${t.text}" → \`${cls}\` (${t.font}/${t.size}px/${t.weight}) ${t.color || ''}\n`
      }
      output += '\n'
    }

    if (images.length) {
      output += `## Image Assets (${images.length})\n\n`
      for (const img of images) {
        const url = imageUrlMap[img.ref]
        output += `- "${img.name}" ${img.w}x${img.h} at(${img.x},${img.y})\n`
        output += `  ref: ${img.ref}\n`
        if (url) output += `  url: ${url}\n`
      }
      output += '\n'
    }

    // Detect layout type for prompt hints
    const hasAutoLayout = !!doc.layoutMode
    const hasAbsoluteKids = doc.children?.some((c) => c.visible !== false && !c.layoutMode && c.absoluteBoundingBox)

    output += `## Implementation Prompt\n\n`
    output += `You MUST implement this Figma design as a Vue 3 SFC that is visually identical to the screenshot above.\n\n`

    output += `### Step 1: Analyze the screenshot\n`
    output += `- Open/view the screenshot URL to understand the full visual layout\n`
    output += `- Identify the visual hierarchy: what is background, what is foreground, what overlaps\n`
    output += `- Note the overall composition: ${hasAutoLayout ? 'uses auto-layout (flexbox)' : hasAbsoluteKids ? 'uses absolute positioning (elements overlap)' : 'mixed layout'}\n\n`

    output += `### Step 2: Build the layout structure\n`
    output += `- Use Tailwind CSS utility classes for ALL styling (no inline styles, no <style> block)\n`
    output += `- For auto-layout frames: use \`flex\`, \`flex-col\`, \`gap-N\`, \`p-N\`, \`items-center\`, \`justify-between\` etc.\n`
    output += `- For overlapping/absolute elements: use \`relative\` on parent, \`absolute\` + \`top-N left-N\` on children\n`
    output += `- Match exact dimensions from the Element Tree (WxH). Use \`w-[Npx]\` \`h-[Npx]\` for non-standard sizes\n`
    output += `- Match exact spacing/gaps from the tree. Convert px to Tailwind: 4px=1, 8px=2, 12px=3, 16px=4, 20px=5, 24px=6, 32px=8\n\n`

    output += `### Step 3: Apply visual styles\n`
    output += `- Colors: use exact hex values from the tree with Tailwind arbitrary \`bg-[#hex]\` \`text-[#hex]\`\n`
    output += `- Border radius: \`rounded-[Npx]\` from the tree's "rounded:Npx"\n`
    output += `- Shadows: map tree "shadow" to Tailwind \`shadow-sm\` / \`shadow\` / \`shadow-md\` / \`shadow-lg\`\n`
    output += `- Borders: \`border border-[#hex]\` from tree "border:#hex"\n`
    output += `- Opacity: \`opacity-N\` from tree "opacity:N"\n`
    output += `- Overflow: \`overflow-hidden\` when tree shows "clip"\n\n`

    output += `### Step 4: Use design system components\n`
    output += `- ALWAYS use components from \`@/components/design/\` instead of raw HTML when a match exists\n`
    output += `- The Component Mapping section above shows which elements → which Vue components\n`
    output += `- Use the exact props, slots, and examples shown for each component\n`
    output += `- Import all used components in \`<script setup>\`\n\n`

    output += `### Step 5: Handle text faithfully\n`
    output += `- Use \`text-design-{level}-{weight}\` CSS classes from the design system (NOT the <Typography> component)\n`
    output += `- Each TEXT node in the Element Tree already shows its exact class (e.g. \`text-design-h3-semibold\`)\n`
    output += `- Level by font size: ≥48px→h0, ≥38px→h1, ≥30px→h2, ≥24px→h3, ≥20px→h4, ≥16px→h5, ≥14px→body, ≥13px→body-sm, ≥12px→footnote, <12px→footnote-sm\n`
    output += `- Weight: 300→light, 400→regular, 500→medium, 600→semibold, 700→bold\n`
    output += `- Example: \`<span class="text-design-h3-semibold">Title</span>\`\n`
    output += `- Use the EXACT text content from the Text Content section — do NOT change or translate\n`
    output += `- For text color, add Tailwind color class: \`<span class="text-design-body-medium text-[#hex]">text</span>\`\n\n`

    output += `### Step 6: Handle images\n`
    output += `- All image assets with download URLs are listed in the Image Assets section\n`
    output += `- Use \`<img :src="url" />\` or the \`<Image>\` component with the provided URL\n`
    output += `- Match exact width/height from the tree\n`
    output += `- For decorative/background images: use as CSS background or absolute-positioned img\n`
    output += `- Elements marked [decorative] (skip) are background effects — recreate with CSS gradients/blur or skip\n\n`

    output += `### Step 7: Final check\n`
    output += `- Compare your output against the screenshot URL for visual parity\n`
    output += `- Verify: correct colors, correct spacing, correct text content, correct image sizes\n`
    output += `- Verify: all design system components used where applicable\n`
    output += `- Verify: no placeholder text, no dummy images, no missing elements\n\n`

    output += `### Tech Stack\n`
    output += `- Vue 3 + Composition API (\`<script setup>\`)\n`
    output += `- Tailwind CSS (utility-first, arbitrary values with \`[]\`)\n`
    output += `- Components: \`@/components/design/\` (see mapping above)\n`
    output += `- Icons: \`@phosphor-icons/vue\` (e.g. \`<PhPencil />\`)\n`
    output += `- NO \`<style>\` block — use Tailwind only\n`
    output += `- Single quotes, no semicolons, 2-space indent\n`

    return txt(output)
  },
)

// ---------- get_figma_node ----------
server.tool('get_figma_node', 'Fetch Figma node tree with layout, styles, text.', {
  figma_url: urlParam, node_id: nodeParam,
  depth: z.number().optional().default(10).describe('Max depth'),
}, async ({ figma_url, node_id, depth }) => {
  const { fileKey, nodeId } = resolveId(figma_url, node_id)
  const doc = await fetchNode(fileKey, nodeId, depth)
  return doc ? json(simplify(doc)) : txt(`Node not found in ${fileKey}`)
})

// ---------- get_figma_screenshot ----------
server.tool('get_figma_screenshot', 'Get rendered image URL of a Figma node. Auto-retries at lower scale on timeout.', {
  figma_url: urlParam, node_id: nodeParam,
  scale: z.number().optional().default(2).describe('Image scale 1-4, auto-reduces on timeout'),
  format: z.enum(['png', 'svg', 'jpg', 'pdf']).optional().default('png'),
}, async ({ figma_url, node_id, scale, format }) => {
  const { fileKey, nodeId } = resolveId(figma_url, node_id)
  if (!nodeId) return txt('Error: node_id required for screenshot')

  for (let s = scale; s >= 0.5; s = s > 1 ? s - 1 : s * 0.5) {
    try {
      const data = await figmaFetch(`/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&scale=${s}&format=${format}`)
      const url = data.images?.[nodeId]
      if (url) {
        const note = s < scale ? ` (reduced from ${scale}x due to timeout)` : ''
        return txt(`${url}\n\nScale: ${s}x ${format}${note}`)
      }
    } catch (e) {
      if (e.message.includes('timeout') || e.message.includes('Render timeout')) {
        if (s <= 0.5) return txt(`Render timeout at all scales for node ${nodeId}. Try a smaller/simpler node.`)
        continue
      }
      throw e
    }
  }
  return txt(`No image for node ${nodeId}`)
})

// ---------- get_figma_styles ----------
server.tool('get_figma_styles', 'Get design tokens (colors, text, effects) from Figma file.', {
  figma_url: urlParam,
}, async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  const data = await figmaFetch(`/files/${fileKey}/styles`)
  return json((data.meta?.styles || []).map((s) => ({ key: s.key, name: s.name, type: s.style_type, desc: s.description })))
})

// ---------- get_figma_components ----------
server.tool('get_figma_components', 'List Figma file components with IDs and names.', {
  figma_url: urlParam,
}, async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  const data = await figmaFetch(`/files/${fileKey}/components`)
  return json((data.meta?.components || []).map((c) => ({ key: c.key, name: c.name, desc: c.description, frame: c.containing_frame?.name, nodeId: c.node_id })))
})

// ---------- map_figma_to_vue ----------
server.tool('map_figma_to_vue', 'Map Figma elements → Vue design system components with imports and props.', {
  figma_url: urlParam, node_id: nodeParam,
}, async ({ figma_url, node_id }) => {
  const { fileKey, nodeId } = resolveId(figma_url, node_id)
  const doc = await fetchNode(fileKey, nodeId)
  if (!doc) return txt('Node not found')
  const matches = mapFigmaToComponents(doc)
  if (!matches.length) return txt('No matches. Available: ' + Object.keys(COMPONENT_MAP).join(', '))
  return json({
    total: matches.length,
    imports: [...new Set(matches.map((m) => COMPONENT_MAP[m.comp]?.import).filter(Boolean))],
    matches: matches.map((m) => {
      const c = COMPONENT_MAP[m.comp]
      return { node: `${m.name} (${m.id})`, type: m.type, vue: m.comp, ex: c?.ex,
        props: c?.props ? Object.entries(c.props).map(([k, v]) => `${k}:${v.type}${v.options ? `[${v.options}]` : ''}`).join(' ') : undefined }
    }),
  })
})

// ---------- list_design_components ----------
server.tool('list_design_components', 'List Vue design system components with props/slots/examples.', {
  filter: z.string().optional().describe('Regex filter by name'),
  category: z.enum(['all', ...Object.keys(CATEGORIES)]).optional().default('all'),
}, async ({ filter, category }) => {
  let entries = Object.entries(COMPONENT_MAP)
  if (filter) { const re = new RegExp(filter, 'i'); entries = entries.filter(([n]) => re.test(n)) }
  if (category !== 'all') { const allow = new Set(CATEGORIES[category] || []); entries = entries.filter(([n]) => allow.has(n)) }
  return json(entries.map(([name, c]) => ({
    name, import: c.import, ex: c.ex,
    props: c.props ? Object.keys(c.props) : [],
    slots: c.slots || [],
  })))
})

// ---------- get_figma_images ----------
server.tool('get_figma_images', 'Get download URLs for images/assets in a Figma file.', {
  figma_url: urlParam,
}, async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  const data = await figmaFetch(`/files/${fileKey}/images`)
  return json(data.meta?.images || {})
})

// ---------- export_nodes ----------
server.tool('export_nodes',
  'Export specific Figma nodes as downloadable PNG/SVG/PDF images. Useful for icons, illustrations, logos. Batch export multiple nodes at once.',
  {
    figma_url: urlParam,
    node_ids: z.string().describe('Comma-separated node IDs to export (e.g. "1:2,3:4,5:6")'),
    format: z.enum(['png', 'svg', 'jpg', 'pdf']).optional().default('png'),
    scale: z.number().optional().default(2).describe('Scale for raster formats (1-4)'),
  },
  async ({ figma_url, node_ids, format, scale }) => {
    const { fileKey } = parseUrl(figma_url)
    const ids = node_ids.split(',').map((id) => id.trim().replaceAll('-', ':')).join(',')

    for (let s = scale; s >= 1; s--) {
      try {
        const data = await figmaFetch(`/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=${format}&scale=${s}`)
        const results = []
        for (const [nodeId, url] of Object.entries(data.images || {})) {
          if (url) results.push({ nodeId, url, format, scale: s })
          else results.push({ nodeId, error: 'render failed' })
        }
        if (results.some((r) => r.url)) {
          const note = s < scale ? `\n(scale reduced from ${scale}x to ${s}x due to timeout)` : ''
          return json({ exports: results, note: note || undefined })
        }
      } catch (e) {
        if (e.message.includes('timeout') || e.message.includes('Render timeout')) {
          if (s <= 1) return txt(`Render timeout for all scales. Try fewer/smaller nodes.`)
          continue
        }
        throw e
      }
    }
    return txt('No images exported')
  },
)

const transport = new StdioServerTransport()
server.connect(transport).then(() => console.error('figma-vue MCP v2 ready'))
