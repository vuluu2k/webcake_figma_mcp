export const txt = (t) => ({ content: [{ type: 'text', text: t }] })
export const json = (o) => txt(JSON.stringify(o, null, 2))
export const visible = (arr) => arr?.filter((x) => x.visible !== false) || []
export const nodeId = (id) => id?.replaceAll('-', ':')

export function hex(c, opacity) {
  if (!c) return undefined
  const r = (c.r * 255) | 0, g = (c.g * 255) | 0, b = (c.b * 255) | 0, a = opacity ?? c.a ?? 1
  return a < 1 ? `rgba(${r},${g},${b},${a.toFixed(2)})` : `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}
