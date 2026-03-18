import { hex, visible } from '../utils.js'

export function simplify(node) {
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

  const fills = visible(node.fills)
  if (fills.length) {
    r.fills = fills.map((f) =>
      f.type === 'SOLID' ? { type: 'solid', color: hex(f.color, f.opacity) }
        : f.type === 'IMAGE' ? { type: 'image', ref: f.imageRef }
          : { type: f.type })
  }

  const strokes = visible(node.strokes)
  if (strokes.length) r.strokes = strokes.map((s) => ({ color: hex(s.color, s.opacity), w: node.strokeWeight }))

  if (node.cornerRadius) r.radius = node.cornerRadius
  else if (node.rectangleCornerRadii) r.radius = node.rectangleCornerRadii

  const fx = visible(node.effects)
  if (fx.length) r.effects = fx.map((e) => ({ type: e.type, color: e.color ? hex(e.color) : undefined, offset: e.offset, radius: e.radius }))

  if (node.type === 'TEXT') {
    const s = node.style || {}
    r.text = { chars: node.characters, size: s.fontSize, family: s.fontFamily, weight: s.fontWeight, align: s.textAlignHorizontal }
  }

  if (node.componentId) r.componentId = node.componentId
  if (node.componentProperties) r.compProps = node.componentProperties

  const kids = visible(node.children)
  if (kids.length) r.children = kids.map(simplify)

  return r
}
