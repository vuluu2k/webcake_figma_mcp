import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { api, parseUrl, resolve, fetchNode, renderImage } from './src/figma/client.js'
import { simplify } from './src/figma/simplify.js'
import { COMPONENT_MAP, CATEGORIES } from './src/design/components.js'
import { mapFigmaToComponents } from './src/design/matcher.js'
import { describeNode } from './src/context/describe.js'
import { collectText, collectImages } from './src/context/collectors.js'
import { buildComponentSection, buildTextSection, buildImageSection } from './src/context/output.js'
import { IMPLEMENTATION_PROMPT } from './src/context/prompt.js'
import { uploadUrls } from './src/figma/upload.js'
import { txt, json } from './src/utils.js'

const server = new McpServer({ name: 'figma-vue', version: '2.0.0', description: 'Figma → Vue 3 MCP' })
const U = z.string().describe('Figma URL or file key')
const N = z.string().optional().describe('Node ID, optional if in URL')

// ===== get_design_context =====

server.tool('get_design_context',
  'Fetch complete Figma design context: screenshot, element tree, component mapping, text, images, implementation prompt. Use this FIRST.',
  { figma_url: U, node_id: N },
  async ({ figma_url, node_id }) => {
    const { fileKey, nodeId } = resolve(figma_url, node_id)
    const doc = await fetchNode(fileKey, nodeId)
    if (!doc) return txt('Node not found')

    const [screenshot, texts, images] = await Promise.all([
      nodeId ? renderImage(fileKey, nodeId, 1).catch(() => null) : null,
      Promise.resolve(collectText(doc)),
      Promise.resolve(collectImages(doc, doc.absoluteBoundingBox)),
    ])
    const matches = mapFigmaToComponents(doc)

    // Resolve Figma image refs → download URLs
    let imageUrlMap = {}
    if (images.length) {
      try { imageUrlMap = (await api(`/files/${fileKey}/images`)).meta?.images || {} } catch (_) {}
    }

    // Auto-upload to Pancake if WEBCAKE_JWT is set
    let pancakeUrlMap = {}
    if (images.length && process.env.WEBCAKE_JWT) {
      const figmaUrls = images.map((img) => imageUrlMap[img.ref]).filter(Boolean)
      if (figmaUrls.length) {
        try {
          const result = await uploadUrls(figmaUrls)
          // Map figma URL → pancake URL from response
          if (Array.isArray(result)) {
            figmaUrls.forEach((fUrl, i) => { if (result[i]) pancakeUrlMap[fUrl] = result[i] })
          } else if (result?.data) {
            // Handle { data: [{ url, content_url }] } format
            for (const item of (Array.isArray(result.data) ? result.data : [result.data])) {
              if (item.content_url) pancakeUrlMap[item.url || figmaUrls[0]] = item.content_url
            }
          }
        } catch (_) { /* non-critical */ }
      }
    }

    const b = doc.absoluteBoundingBox
    let out = `# Design Context: ${doc.name}\nSize: ${b ? `${Math.round(b.width)}x${Math.round(b.height)}px` : 'unknown'}\n`
    if (screenshot?.images?.[nodeId]) out += `Screenshot: ${screenshot.images[nodeId]}\n`
    out += `\n## Element Tree\n(TYPE "name" WxH at(x,y) [layout] styles → <Component>)\n\n`
    out += describeNode(doc, null).join('\n') + '\n\n'
    if (matches.length) out += buildComponentSection(matches)
    if (texts.length) out += buildTextSection(texts)
    if (images.length) out += buildImageSection(images, imageUrlMap, pancakeUrlMap)

    const hasAuto = !!doc.layoutMode
    const hasAbs = doc.children?.some((c) => c.visible !== false && !c.layoutMode && c.absoluteBoundingBox)
    out += IMPLEMENTATION_PROMPT(hasAuto ? 'auto-layout (flexbox)' : hasAbs ? 'absolute positioning (elements overlap)' : 'mixed layout')
    return txt(out)
  },
)

// ===== get_figma_node =====

server.tool('get_figma_node', 'Fetch raw Figma node tree (JSON).', {
  figma_url: U, node_id: N, depth: z.number().optional().default(10),
}, async ({ figma_url, node_id, depth }) => {
  const { fileKey, nodeId } = resolve(figma_url, node_id)
  const doc = await fetchNode(fileKey, nodeId, depth)
  return doc ? json(simplify(doc)) : txt('Node not found')
})

// ===== get_figma_screenshot =====

server.tool('get_figma_screenshot', 'Get rendered image URL. Auto-retries at lower scale.', {
  figma_url: U, node_id: N,
  scale: z.number().optional().default(2),
  format: z.enum(['png', 'svg', 'jpg', 'pdf']).optional().default('png'),
}, async ({ figma_url, node_id, scale, format }) => {
  const { fileKey, nodeId } = resolve(figma_url, node_id)
  if (!nodeId) return txt('Error: node_id required')
  const r = await renderImage(fileKey, nodeId, scale, format)
  if (!r) return txt(`Render timeout for node ${nodeId}`)
  const url = r.images[nodeId]
  if (!url) return txt(`No image for node ${nodeId}`)
  return txt(`${url}\n\nScale: ${r.scale}x ${format}${r.scale < scale ? ` (reduced from ${scale}x)` : ''}`)
})

// ===== get_figma_styles =====

server.tool('get_figma_styles', 'Get design tokens from Figma file.', { figma_url: U }, async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  const d = await api(`/files/${fileKey}/styles`)
  return json((d.meta?.styles || []).map((s) => ({ key: s.key, name: s.name, type: s.style_type, desc: s.description })))
})

// ===== get_figma_components =====

server.tool('get_figma_components', 'List Figma file components.', { figma_url: U }, async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  const d = await api(`/files/${fileKey}/components`)
  return json((d.meta?.components || []).map((c) => ({ key: c.key, name: c.name, desc: c.description, frame: c.containing_frame?.name, nodeId: c.node_id })))
})

// ===== map_figma_to_vue =====

server.tool('map_figma_to_vue', 'Map Figma elements → Vue design system components.', {
  figma_url: U, node_id: N,
}, async ({ figma_url, node_id }) => {
  const { fileKey, nodeId } = resolve(figma_url, node_id)
  const doc = await fetchNode(fileKey, nodeId)
  if (!doc) return txt('Node not found')
  const matches = mapFigmaToComponents(doc)
  if (!matches.length) return txt('No matches. Available: ' + Object.keys(COMPONENT_MAP).join(', '))
  return json({
    total: matches.length,
    imports: [...new Set(matches.map((m) => COMPONENT_MAP[m.comp]?.import).filter(Boolean))],
    matches: matches.map((m) => {
      const c = COMPONENT_MAP[m.comp]
      return {
        node: `${m.name} (${m.id})`, type: m.type, vue: m.comp, ex: c?.ex,
        props: c?.props ? Object.entries(c.props).map(([k, v]) => `${k}:${v.type}${v.options ? `[${v.options}]` : ''}`).join(' ') : undefined,
      }
    }),
  })
})

// ===== list_design_components =====

server.tool('list_design_components', 'List Vue design system components.', {
  filter: z.string().optional(),
  category: z.enum(['all', ...Object.keys(CATEGORIES)]).optional().default('all'),
}, async ({ filter, category }) => {
  let entries = Object.entries(COMPONENT_MAP)
  if (filter) { const re = new RegExp(filter, 'i'); entries = entries.filter(([n]) => re.test(n)) }
  if (category !== 'all') { const allow = new Set(CATEGORIES[category]); entries = entries.filter(([n]) => allow.has(n)) }
  return json(entries.map(([name, c]) => ({ name, import: c.import, ex: c.ex, props: c.props ? Object.keys(c.props) : [], slots: c.slots || [] })))
})

// ===== get_figma_images =====

server.tool('get_figma_images', 'Get download URLs for fill images.', { figma_url: U }, async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  return json((await api(`/files/${fileKey}/images`)).meta?.images || {})
})

// ===== export_nodes =====

server.tool('export_nodes', 'Export Figma nodes as PNG/SVG/PDF.', {
  figma_url: U,
  node_ids: z.string().describe('Comma-separated node IDs'),
  format: z.enum(['png', 'svg', 'jpg', 'pdf']).optional().default('png'),
  scale: z.number().optional().default(2),
}, async ({ figma_url, node_ids, format, scale }) => {
  const { fileKey } = parseUrl(figma_url)
  const ids = node_ids.split(',').map((id) => id.trim().replaceAll('-', ':')).join(',')
  const r = await renderImage(fileKey, ids, scale, format)
  if (!r) return txt('Render timeout. Try fewer/smaller nodes.')
  const exports = Object.entries(r.images).map(([id, url]) => url ? { id, url, format, scale: r.scale } : { id, error: 'failed' })
  return json({ exports, ...(r.scale < scale ? { note: `scale reduced to ${r.scale}x` } : {}) })
})

// ===== upload_images =====

server.tool('upload_images', 'Upload image URLs to Webcake CDN. Converts external URLs (Figma, etc.) to permanent pancake.vn URLs. Requires WEBCAKE_JWT env.', {
  urls: z.array(z.string()).describe('Array of image URLs to upload'),
}, async ({ urls }) => {
  if (!process.env.WEBCAKE_JWT) return txt('Error: WEBCAKE_JWT env required. Set it in .mcp.json')
  const result = await uploadUrls(urls)
  return json(result)
})

// ===== Start =====

const transport = new StdioServerTransport()
server.connect(transport).then(() => console.error('figma-vue MCP v2 ready'))
