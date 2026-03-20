import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

import { api, parseUrl, resolve, fetchNode, renderImage } from './src/figma/client.js'
import { simplify } from './src/figma/simplify.js'
import { COMPONENT_MAP, CATEGORIES } from './src/design/components.js'
import { buildMatchMap } from './src/design/matcher.js'
import { describeNode } from './src/context/describe.js'
import { collectText, collectImages } from './src/context/collectors.js'
import { buildComponentSection, buildTextSection, buildImageSection } from './src/context/output.js'
import { IMPLEMENTATION_PROMPT } from './src/context/prompt.js'
import { uploadUrls } from './src/figma/upload.js'
import { downloadToFile } from './src/figma/download.js'
import { txt, json, nodeId } from './src/utils.js'

const server = new McpServer({ name: 'webcake_figma_mcp', version: '2.1.0', description: 'Figma → Vue 3 MCP' })
const U = z.string().describe('Figma URL or file key')
const N = z.string().optional().describe('Node ID, optional if in URL')

// Wrap tool handler with error boundary
const safe = (fn) => async (args) => {
  try {
    return await fn(args)
  } catch (e) {
    console.error(`Tool error: ${e.message}`)
    return txt(`Error: ${e.message}`)
  }
}

// ===== get_design_context =====

server.tool('get_design_context',
  'Fetch complete Figma design context: screenshot, element tree, component mapping, text, images, implementation prompt. Use this FIRST.',
  { figma_url: U, node_id: N },
  safe(async ({ figma_url, node_id }) => {
    const { fileKey, nodeId: nid } = resolve(figma_url, node_id)
    const doc = await fetchNode(fileKey, nid)
    if (!doc) return txt('Node not found')

    // Pre-compute component matches once — O(N) single pass
    const matchMap = buildMatchMap(doc)
    const matches = [...matchMap.values()]

    // Parallel: screenshot + text + images
    const [screenshot, texts, images] = await Promise.all([
      nid ? renderImage(fileKey, nid, 1).catch(() => null) : null,
      Promise.resolve(collectText(doc)),
      Promise.resolve(collectImages(doc, doc.absoluteBoundingBox)),
    ])

    // Resolve Figma image refs → download URLs
    let imageUrlMap = {}
    if (images.length) {
      try { imageUrlMap = (await api(`/files/${fileKey}/images`)).meta?.images || {} } catch (e) {
        console.error(`Image URL fetch failed: ${e.message}`)
      }
    }

    // Auto-upload to Webcake CDN if WEBCAKE_JWT is set
    let webcakeUrlMap = {}
    if (images.length && process.env.WEBCAKE_JWT) {
      const figmaUrls = images.map((img) => imageUrlMap[img.ref]).filter(Boolean)
      if (figmaUrls.length) {
        try {
          const contentUrls = await uploadUrls(figmaUrls)
          figmaUrls.forEach((fUrl, i) => { if (contentUrls[i]) webcakeUrlMap[fUrl] = contentUrls[i] })
        } catch (e) { console.error(`CDN upload failed: ${e.message}`) }
      }
    }

    // Download screenshot to local file so Claude can VIEW it
    let screenshotPath = null
    const screenshotUrl = screenshot?.images?.[nid]
    if (screenshotUrl) {
      const fname = `${fileKey}_${nid?.replace(/:/g, '-') || 'root'}.png`
      screenshotPath = await downloadToFile(screenshotUrl, fname).catch((e) => {
        console.error(`Screenshot download failed: ${e.message}`)
        return null
      })
    }

    const b = doc.absoluteBoundingBox
    let out = `# Design Context: ${doc.name}\nSize: ${b ? `${Math.round(b.width)}x${Math.round(b.height)}px` : 'unknown'}\n`
    if (screenshotPath) out += `Screenshot (local): ${screenshotPath}\n`
    if (screenshotUrl) out += `Screenshot (url): ${screenshotUrl}\n`
    out += `\n## Element Tree\n(TYPE "name" WxH at(x,y) [layout] styles → <Component>)\n\n`
    out += describeNode(doc, null, 0, matchMap).join('\n') + '\n\n'
    if (matches.length) out += buildComponentSection(matches)
    if (texts.length) out += buildTextSection(texts)
    if (images.length) out += buildImageSection(images, imageUrlMap, webcakeUrlMap)

    const hasAuto = !!doc.layoutMode
    const hasAbs = doc.children?.some((c) => c.visible !== false && !c.layoutMode && c.absoluteBoundingBox)
    out += IMPLEMENTATION_PROMPT(hasAuto ? 'auto-layout (flexbox)' : hasAbs ? 'absolute positioning (elements overlap)' : 'mixed layout')
    return txt(out)
  }),
)

// ===== get_figma_node =====

server.tool('get_figma_node', 'Fetch raw Figma node tree (JSON).', {
  figma_url: U, node_id: N, depth: z.number().optional().default(10),
}, safe(async ({ figma_url, node_id, depth }) => {
  const { fileKey, nodeId: nid } = resolve(figma_url, node_id)
  const doc = await fetchNode(fileKey, nid, depth)
  return doc ? json(simplify(doc)) : txt('Node not found')
}))

// ===== get_figma_screenshot =====

server.tool('get_figma_screenshot', 'Get rendered image URL. Auto-retries at lower scale.', {
  figma_url: U, node_id: N,
  scale: z.number().optional().default(2),
  format: z.enum(['png', 'svg', 'jpg', 'pdf']).optional().default('png'),
}, safe(async ({ figma_url, node_id, scale, format }) => {
  const { fileKey, nodeId: nid } = resolve(figma_url, node_id)
  if (!nid) return txt('Error: node_id required')
  const r = await renderImage(fileKey, nid, scale, format)
  if (!r) return txt(`Render timeout for node ${nid}`)
  const url = r.images[nid]
  if (!url) return txt(`No image for node ${nid}`)
  return txt(`${url}\n\nScale: ${r.scale}x ${format}${r.scale < scale ? ` (reduced from ${scale}x)` : ''}`)
}))

// ===== get_figma_styles =====

server.tool('get_figma_styles', 'Get design tokens from Figma file.', { figma_url: U }, safe(async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  const d = await api(`/files/${fileKey}/styles`)
  return json((d.meta?.styles || []).map((s) => ({ key: s.key, name: s.name, type: s.style_type, desc: s.description })))
}))

// ===== get_figma_components =====

server.tool('get_figma_components', 'List Figma file components.', { figma_url: U }, safe(async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  const d = await api(`/files/${fileKey}/components`)
  return json((d.meta?.components || []).map((c) => ({ key: c.key, name: c.name, desc: c.description, frame: c.containing_frame?.name, nodeId: c.node_id })))
}))

// ===== map_figma_to_vue =====

server.tool('map_figma_to_vue', 'Map Figma elements → Vue design system components.', {
  figma_url: U, node_id: N,
}, safe(async ({ figma_url, node_id }) => {
  const { fileKey, nodeId: nid } = resolve(figma_url, node_id)
  const doc = await fetchNode(fileKey, nid)
  if (!doc) return txt('Node not found')
  const matchMap = buildMatchMap(doc)
  const matches = [...matchMap.values()]
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
}))

// ===== list_design_components =====

server.tool('list_design_components', 'List Vue design system components.', {
  filter: z.string().optional(),
  category: z.enum(['all', ...Object.keys(CATEGORIES)]).optional().default('all'),
}, safe(async ({ filter, category }) => {
  let entries = Object.entries(COMPONENT_MAP)
  if (filter) { const re = new RegExp(filter, 'i'); entries = entries.filter(([n]) => re.test(n)) }
  if (category !== 'all') { const allow = new Set(CATEGORIES[category]); entries = entries.filter(([n]) => allow.has(n)) }
  return json(entries.map(([name, c]) => ({ name, import: c.import, ex: c.ex, props: c.props ? Object.keys(c.props) : [], slots: c.slots || [] })))
}))

// ===== get_figma_images =====

server.tool('get_figma_images', 'Get download URLs for fill images.', { figma_url: U }, safe(async ({ figma_url }) => {
  const { fileKey } = parseUrl(figma_url)
  return json((await api(`/files/${fileKey}/images`)).meta?.images || {})
}))

// ===== export_nodes =====

server.tool('export_nodes', 'Export Figma nodes as PNG/SVG/PDF.', {
  figma_url: U,
  node_ids: z.string().describe('Comma-separated node IDs'),
  format: z.enum(['png', 'svg', 'jpg', 'pdf']).optional().default('png'),
  scale: z.number().optional().default(2),
}, safe(async ({ figma_url, node_ids, format, scale }) => {
  const { fileKey } = parseUrl(figma_url)
  const ids = node_ids.split(',').map((id) => nodeId(id.trim())).join(',')
  const r = await renderImage(fileKey, ids, scale, format)
  if (!r) return txt('Render timeout. Try fewer/smaller nodes.')
  const exports = Object.entries(r.images).map(([id, url]) => url ? { id, url, format, scale: r.scale } : { id, error: 'failed' })
  return json({ exports, ...(r.scale < scale ? { note: `scale reduced to ${r.scale}x` } : {}) })
}))

// ===== upload_images =====

server.tool('upload_images', 'Upload image URLs to Webcake CDN. Converts external URLs to permanent content.pancake.vn URLs. Requires WEBCAKE_JWT env.', {
  urls: z.array(z.string()).describe('Array of image URLs to upload'),
}, safe(async ({ urls }) => {
  if (!process.env.WEBCAKE_JWT) return txt('Error: WEBCAKE_JWT env required. Set it in .mcp.json')
  const contentUrls = await uploadUrls(urls)
  return json(urls.map((src, i) => ({ src, cdn: contentUrls[i] || null })))
}))

// ===== Start =====

const transport = new StdioServerTransport()
server.connect(transport).then(() => console.error('webcake_figma_mcp MCP v2.1 ready'))
