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
      const wait = (retries + 1) * 2000
      await new Promise((r) => setTimeout(r, wait))
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

const txt = (text) => ({ content: [{ type: 'text', text }] })
const json = (obj) => txt(JSON.stringify(obj, null, 2))

// Simplify Figma node tree — strip invisible, flatten styles
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

function hex(c, opacity) {
  if (!c) return undefined
  const r = (c.r * 255) | 0, g = (c.g * 255) | 0, b = (c.b * 255) | 0
  const a = opacity ?? c.a ?? 1
  return a < 1 ? `rgba(${r},${g},${b},${a.toFixed(2)})` : `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

// ===== Vue Code Generation (pixel-faithful) =====

const FONT_VARIANTS = [[32, 'h1'], [24, 'h2'], [20, 'h3'], [18, 'h4'], [16, 'body'], [14, 'body-sm'], [12, 'footnote'], [0, 'footnote-sm']]
const FONT_WEIGHTS = [[700, 'bold'], [600, 'semi-bold'], [500, 'medium'], [400, 'regular'], [300, 'light']]
const ALIGN_MAP = { CENTER: 'justify-center', MAX: 'justify-end', SPACE_BETWEEN: 'justify-between' }
const CROSS_MAP = { CENTER: 'items-center', MAX: 'items-end' }

// Tailwind spacing: round px to nearest Tailwind unit
const tw = (px) => {
  if (!px || px < 0) return 0
  // Tailwind spacing: 1=4px. Use exact value for common sizes, bracket for odd ones
  const unit = Math.round(px / 4)
  return unit || 1
}
const twVal = (px) => {
  if (!px || px < 0) return null
  const unit = Math.round(px / 4)
  // Standard Tailwind values
  if (unit > 0 && unit <= 96) return `${unit}`
  // Use arbitrary value for large sizes
  return `[${Math.round(px)}px]`
}

// Map Figma color to closest Tailwind color or arbitrary
const TW_COLORS = {
  '#ffffff': 'white', '#000000': 'black', '#f9fafb': 'gray-50', '#f3f4f6': 'gray-100',
  '#e5e7eb': 'gray-200', '#d1d5db': 'gray-300', '#9ca3af': 'gray-400', '#6b7280': 'gray-500',
  '#4b5563': 'gray-600', '#374151': 'gray-700', '#1f2937': 'gray-800', '#111827': 'gray-900',
  '#ef4444': 'red-500', '#f97316': 'orange-500', '#eab308': 'yellow-500', '#22c55e': 'green-500',
  '#3b82f6': 'blue-500', '#6366f1': 'indigo-500', '#8b5cf6': 'violet-500',
}
function twColor(hex) {
  if (!hex) return null
  return TW_COLORS[hex] || `[${hex}]`
}

function typoVariant(node) {
  const size = node.text?.size || node.style?.fontSize
  if (!size) return null
  for (const [min, v] of FONT_VARIANTS) if (size >= min) return v
  return 'footnote-sm'
}

function typoWeight(node) {
  const w = node.text?.weight || node.style?.fontWeight
  if (!w) return null
  for (const [min, v] of FONT_WEIGHTS) if (w >= min) return v
  return 'regular'
}

function nodeClasses(node) {
  const cls = []
  const layout = node.layout
  const mode = layout?.mode

  // Flex layout
  if (mode) {
    cls.push(mode === 'HORIZONTAL' ? 'flex' : 'flex flex-col')
    const gap = layout.gap
    if (gap > 0) { const g = twVal(gap); if (g) cls.push(`gap-${g}`) }
    if (ALIGN_MAP[layout.align]) cls.push(ALIGN_MAP[layout.align])
    if (CROSS_MAP[layout.cross]) cls.push(CROSS_MAP[layout.cross])

    // Padding
    const [pt, pr, pb, pl] = (layout.padding || []).map((v) => twVal(v || 0))
    if (pt && pt === pr && pr === pb && pb === pl && pt !== '0') cls.push(`p-${pt}`)
    else {
      if (pt && pt === pb && pt !== '0') cls.push(`py-${pt}`)
      else { if (pt && pt !== '0') cls.push(`pt-${pt}`); if (pb && pb !== '0') cls.push(`pb-${pb}`) }
      if (pl && pl === pr && pl !== '0') cls.push(`px-${pl}`)
      else { if (pl && pl !== '0') cls.push(`pl-${pl}`); if (pr && pr !== '0') cls.push(`pr-${pr}`) }
    }
  }

  // Dimensions
  if (node.bounds) {
    const w = twVal(node.bounds.w)
    const h = twVal(node.bounds.h)
    // Only add explicit sizes for non-auto-layout or root-level containers
    if (!mode && w && node.type !== 'TEXT') cls.push(`w-${w}`)
    if (!mode && h && node.type !== 'TEXT') cls.push(`h-${h}`)
  }

  // Background
  const fill = node.fills?.[0]
  if (fill?.type === 'solid' && fill.color) {
    const c = twColor(fill.color)
    if (c && c !== 'white') cls.push(`bg-${c}`)
  }

  // Border radius
  if (node.radius) {
    const r = typeof node.radius === 'number' ? node.radius : node.radius[0]
    if (r > 0) {
      if (r >= 9999) cls.push('rounded-full')
      else {
        const rv = twVal(r)
        cls.push(rv === '1' ? 'rounded' : rv === '2' ? 'rounded-lg' : rv === '3' ? 'rounded-xl' : `rounded-${rv}`)
      }
    }
  }

  // Border
  if (node.strokes?.length) {
    const s = node.strokes[0]
    cls.push('border')
    if (s.color) cls.push(`border-${twColor(s.color)}`)
  }

  // Shadow
  const shadow = node.effects?.find((e) => e.type === 'DROP_SHADOW')
  if (shadow) {
    const r = shadow.radius || 0
    if (r <= 3) cls.push('shadow-sm')
    else if (r <= 6) cls.push('shadow')
    else if (r <= 15) cls.push('shadow-md')
    else if (r <= 25) cls.push('shadow-lg')
    else cls.push('shadow-xl')
  }

  // Overflow
  if (node.clipsContent) cls.push('overflow-hidden')

  return cls.join(' ')
}

// Build real component props from Figma node data
function buildCompProps(compName, node, rawNode) {
  const text = extractText(rawNode || node)

  switch (compName) {
    case 'Button': {
      const label = text || node.name?.replace(/_?button.*/i, '').replace(/^_/, '').trim() || 'Button'
      const type = /danger|delete|remove/i.test(node.name) ? 'danger'
        : /secondary|outline|ghost/i.test(node.name) ? 'secondary'
          : /warning/i.test(node.name) ? 'warning' : 'primary'
      const size = guessSize(node)
      return `<Button type="${type}" size="${size}" label="${esc(label)}" />`
    }
    case 'Input': {
      const label = extractLabel(rawNode || node)
      const ph = text || 'Enter value'
      return `<Input v-model:value="form.value" ${label ? `label="${esc(label)}" ` : ''}placeholder="${esc(ph)}" />`
    }
    case 'Checkbox': {
      const label = text || node.name || 'Option'
      return `<Checkbox v-model:checked="checked" label="${esc(label)}" />`
    }
    case 'Tags': {
      const label = text || node.name || 'Tag'
      const type = /success|active|connect/i.test(label) ? 'success'
        : /error|fail|disconnect/i.test(label) ? 'error'
          : /warn/i.test(label) ? 'warning'
            : /info/i.test(label) ? 'info' : 'secondary'
      return `<Tags type="${type}" size="md">${esc(label)}</Tags>`
    }
    case 'Badge': {
      return `<Badge :count="0" type="error" />`
    }
    case 'Avatar': {
      const size = node.bounds ? Math.min(node.bounds.w, node.bounds.h) : 32
      return `<Avatar :src="avatarUrl" :size="${Math.round(size)}" />`
    }
    case 'Image': {
      const w = node.bounds?.w || 200
      const h = node.bounds?.h || 150
      const ref = node.fills?.find((f) => f.type === 'image')?.ref
      return `<Image :src="${ref ? `'figma:${ref}'` : 'imageUrl'}" :width="${Math.round(w)}" :height="${Math.round(h)}" alt="${esc(node.name)}" />`
    }
    case 'Sidebar': {
      return `<Sidebar v-model:value="activeMenu" :options="sidebarOptions" />`
    }
    case 'Dropdown': {
      return `<Dropdown :options="dropdownOptions" :trigger="['click']">\n      <slot />\n    </Dropdown>`
    }
    case 'Modal': {
      const title = text || node.name || 'Modal'
      return `<Modal v-model:visible="showModal" title="${esc(title)}">\n      <slot />\n    </Modal>`
    }
    case 'Table': {
      return `<Table :columns="columns" :data-source="dataSource" :loading="loading">\n      <template #bodyCell="{ column, record }">\n        <!-- cell content -->\n      </template>\n    </Table>`
    }
    case 'Select': {
      const title = extractLabel(rawNode || node)
      return `<Select v-model:value="selectedValue" :options="options" ${title ? `title="${esc(title)}"` : ''} />`
    }
    case 'Switch': {
      const label = text || node.name || ''
      return `<Switch v-model:checked="enabled" ${label ? `label="${esc(label)}"` : ''} />`
    }
    case 'Tooltip': {
      return `<Tooltip><template #title>${text || 'Tooltip'}</template><slot /></Tooltip>`
    }
    case 'Alert': {
      const title = text || node.name || 'Alert'
      return `<Alert type="info" title="${esc(title)}" />`
    }
    case 'Pagination': {
      return `<Pagination v-model:current="page" :total="total" />`
    }
    case 'Tabs': {
      return `<Tabs :options="tabOptions" size="md" />`
    }
    default: {
      const comp = COMPONENT_MAP[compName]
      return comp?.ex || `<${compName} />`
    }
  }
}

function esc(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;') }

function guessSize(node) {
  const h = node.bounds?.h || 0
  if (h <= 24) return 'xs'
  if (h <= 32) return 'sm'
  if (h <= 40) return 'md'
  return 'lg'
}

// Walk raw Figma node tree to extract text
function extractText(node) {
  if (!node) return ''
  if (node.type === 'TEXT') return node.characters || node.text?.chars || ''
  if (node.children) {
    for (const child of node.children) {
      if (child.visible === false) continue
      const t = extractText(child)
      if (t) return t
    }
  }
  return ''
}

// Extract label from sibling or parent text node
function extractLabel(node) {
  if (!node) return ''
  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'TEXT' && child.visible !== false) {
        const t = child.characters || child.text?.chars || ''
        if (t && t.length < 50) return t
      }
    }
  }
  return ''
}

// Collect image refs from node tree
function collectImageRefs(node, refs = new Set()) {
  if (node.fills) {
    for (const f of node.fills) {
      if (f.type === 'image' || f.type === 'IMAGE') refs.add(f.ref || f.imageRef)
    }
  }
  if (node.children) {
    for (const child of node.children) collectImageRefs(child, refs)
  }
  return refs
}

function genTemplate(node, matchMap, rawMap, indent = 1) {
  const sp = '  '.repeat(indent)
  const match = matchMap.get(node.id)

  if (match) {
    const raw = rawMap?.get(node.id)
    const rendered = buildCompProps(match, node, raw)
    return `${sp}<!-- ${node.name} -->\n${sp}${rendered}\n`
  }

  if (node.type === 'TEXT') {
    const chars = node.text?.chars || node.chars || node.name || ''
    const v = typoVariant(node)
    const w = typoWeight(node)
    const color = node.fills?.[0]?.color ? twColor(node.fills[0].color) : null
    const align = node.text?.align
    const alignCls = align === 'CENTER' ? ' text-center' : align === 'RIGHT' ? ' text-right' : ''
    const colorCls = color && color !== 'black' && color !== 'white' ? ` text-${color}` : ''
    if (v) {
      return `${sp}<Typography variant="${v}"${w && w !== 'regular' ? ` weight="${w}"` : ''}${colorCls ? ` class="${colorCls.trim()}"` : ''}>${esc(chars)}</Typography>\n`
    }
    return `${sp}<span class="text-sm${alignCls}${colorCls}">${esc(chars)}</span>\n`
  }

  // Image fill on non-component node
  const imgFill = node.fills?.find((f) => f.type === 'image')
  if (imgFill && !node.children?.length) {
    const w = node.bounds?.w || 100
    const h = node.bounds?.h || 100
    return `${sp}<Image :src="'figma:${imgFill.ref}'" :width="${Math.round(w)}" :height="${Math.round(h)}" alt="${esc(node.name)}" />\n`
  }

  if (!node.children?.length) return ''

  const kids = node.children.filter((c) => c.visible !== false)
  const cls = nodeClasses(node)
  if (!cls) {
    return kids.map((c) => genTemplate(c, matchMap, rawMap, indent)).join('')
  }
  return `${sp}<div class="${cls}">\n${kids.map((c) => genTemplate(c, matchMap, rawMap, indent + 1)).join('')}${sp}</div>\n`
}

function generateVue(matches, nodeTree, rawDoc, fileKey) {
  const matchMap = new Map(matches.map((m) => [m.id, m.comp]))

  // Build raw node lookup for extracting text from original Figma data
  const rawMap = new Map()
  function indexRaw(node) {
    if (!node) return
    rawMap.set(node.id, node)
    if (node.children) node.children.forEach(indexRaw)
  }
  indexRaw(rawDoc)

  const body = genTemplate(nodeTree, matchMap, rawMap)

  // Collect imports
  const usedComps = new Set()
  matchMap.forEach((comp) => usedComps.add(comp))
  // Check if Typography/Image are used in template (text nodes, image fills)
  if (body.includes('<Typography')) usedComps.add('Typography')
  if (body.includes('<Image')) usedComps.add('Image')
  const imports = [...usedComps].map((c) => COMPONENT_MAP[c]?.import).filter(Boolean).sort()

  // Collect image refs for asset download
  const imageRefs = [...collectImageRefs(nodeTree)]

  let code = `<template>\n${body}</template>\n\n<script setup>\n`
  code += imports.map((i) => `  ${i}`).join('\n')
  code += `\n</script>\n`

  if (imageRefs.length) {
    code += `\n<!-- Image assets from Figma (use get_figma_images to get download URLs):\n`
    code += imageRefs.map((r) => `     ${r}`).join('\n')
    code += `\n-->\n`
  }

  return code
}

// ===== MCP Server =====
const server = new McpServer({
  name: 'figma-vue',
  version: '1.0.0',
  description: 'Figma → Vue 3 MCP using @/components/design/',
})

const urlParam = z.string().describe('Figma URL or file key')
const nodeParam = z.string().optional().describe('Node ID (e.g. "1:2" or "1-2"), optional if in URL')

server.tool('get_figma_node', 'Fetch Figma node tree with layout, styles, text.', {
  figma_url: urlParam, node_id: nodeParam,
  depth: z.number().optional().default(10).describe('Max depth'),
}, async ({ figma_url, node_id, depth }) => {
  const { fileKey, nodeId } = resolveId(figma_url, node_id)
  const doc = await fetchNode(fileKey, nodeId, depth)
  return doc ? json(simplify(doc)) : txt(`Node not found in ${fileKey}`)
})

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

server.tool('get_figma_styles', 'Get design tokens (colors, text, effects) from Figma file.', {
  figma_url: urlParam,
}, async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  const data = await figmaFetch(`/files/${fileKey}/styles`)
  return json((data.meta?.styles || []).map((s) => ({ key: s.key, name: s.name, type: s.style_type, desc: s.description })))
})

server.tool('get_figma_components', 'List Figma file components with IDs and names.', {
  figma_url: urlParam,
}, async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  const data = await figmaFetch(`/files/${fileKey}/components`)
  return json((data.meta?.components || []).map((c) => ({ key: c.key, name: c.name, desc: c.description, frame: c.containing_frame?.name, nodeId: c.node_id })))
})

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

server.tool('generate_vue_code', 'Generate pixel-faithful Vue 3 SFC from Figma node. Uses actual text, colors, spacing, dimensions from design.', {
  figma_url: urlParam, node_id: nodeParam,
  component_name: z.string().optional().default('FigmaComponent'),
}, async ({ figma_url, node_id, component_name }) => {
  const { fileKey, nodeId } = resolveId(figma_url, node_id)
  const doc = await fetchNode(fileKey, nodeId)
  if (!doc) return txt('Node not found')
  const matches = mapFigmaToComponents(doc)
  const simplified = simplify(doc)
  const vue = generateVue(matches, simplified, doc, fileKey)
  return txt(`<!-- ${component_name}.vue -->\n<!-- Figma: ${figma_url} | Node: ${nodeId || 'root'} -->\n\n${vue}`)
})

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

server.tool('get_figma_images', 'Get download URLs for images/assets in a Figma file.', {
  figma_url: urlParam,
}, async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  const data = await figmaFetch(`/files/${fileKey}/images`)
  return json(data.meta?.images || {})
})

const transport = new StdioServerTransport()
server.connect(transport).then(() => console.error('figma-vue MCP ready'))
