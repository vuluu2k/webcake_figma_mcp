import { nodeId } from '../utils.js'

const API = 'https://api.figma.com/v1'
const TOKEN = process.env.FIGMA_ACCESS_TOKEN
if (!TOKEN) { console.error('FIGMA_ACCESS_TOKEN required'); process.exit(1) }

export async function api(path, retries = 0) {
  const res = await fetch(`${API}${path}`, { headers: { 'X-Figma-Token': TOKEN } })
  if (!res.ok) {
    const body = await res.text()
    if (res.status === 429 && retries < 3) {
      await new Promise((r) => setTimeout(r, (retries + 1) * 2000))
      return api(path, retries + 1)
    }
    throw new Error(`Figma API ${res.status}: ${body}`)
  }
  return res.json()
}

export function parseUrl(input) {
  const fileKey = input.match(/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/)?.[1] || input.split(/[/?]/)[0]
  const raw = input.match(/node-id=([^&]+)/)?.[1]
  return { fileKey, nodeId: raw ? nodeId(decodeURIComponent(raw)) : null }
}

export function resolve(url, nid) {
  const p = parseUrl(url)
  return { fileKey: p.fileKey, nodeId: nodeId(nid) || p.nodeId }
}

export async function fetchNode(fileKey, nid, depth = 15) {
  if (nid) {
    const d = await api(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nid)}&depth=${depth}`)
    return d.nodes?.[nid]?.document || null
  }
  return (await api(`/files/${fileKey}?depth=${depth}`)).document
}

export async function renderImage(fileKey, ids, scale = 2, format = 'png') {
  const minScale = format === 'svg' ? 1 : 0.5
  for (let s = scale; s >= minScale; s = s > 1 ? s - 1 : s * 0.5) {
    try {
      const d = await api(`/images/${fileKey}?ids=${encodeURIComponent(ids)}&scale=${s}&format=${format}`)
      if (Object.values(d.images || {}).some(Boolean)) return { images: d.images, scale: s }
    } catch (e) {
      if (/timeout/i.test(e.message)) {
        console.error(`renderImage: timeout at scale ${s}, retrying lower`)
        if (s <= minScale) break
        continue
      }
      throw e
    }
  }
  return null
}
