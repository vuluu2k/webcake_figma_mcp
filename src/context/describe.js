import { hex, visible } from '../utils.js'
import { textDesignClass } from '../design/text.js'
import { mapFigmaToComponents } from '../design/matcher.js'

function isVectorGroup(node) {
  const kids = visible(node.children)
  return kids.length > 0 && kids.every((c) => c.type === 'VECTOR' || (c.type === 'GROUP' && isVectorGroup(c)))
}

function isDecorative(node) {
  if (node.type === 'ELLIPSE' && node.effects?.some((e) => e.visible !== false && /BLUR/.test(e.type))) return true
  if (node.type === 'GROUP' && node.children) {
    const kids = visible(node.children)
    if (kids.length > 5 && kids.filter((c) => c.type === 'VECTOR' || (c.type === 'GROUP' && isVectorGroup(c))).length > kids.length * 0.7) return true
    if (kids.every((c) => isDecorative(c))) return true
  }
  return false
}

export function describeNode(node, parentBounds, depth = 0) {
  const sp = '  '.repeat(depth)
  const lines = []
  const b = node.absoluteBoundingBox
  const w = b ? Math.round(b.width) : 0
  const h = b ? Math.round(b.height) : 0

  if (isDecorative(node)) return [`${sp}[decorative] ${node.type} "${node.name}" ${w}x${h} (skip)`]
  if (node.type === 'VECTOR' && !node.fills?.some((f) => f.visible !== false && f.type === 'IMAGE')) return lines

  const relX = b && parentBounds ? Math.round(b.x - parentBounds.x) : 0
  const relY = b && parentBounds ? Math.round(b.y - parentBounds.y) : 0
  const pos = b && parentBounds ? ` at (${relX}, ${relY})` : ''

  if (node.type === 'LINE') return [`${sp}LINE "${node.name}" ${w}x${h}${pos} → <Divider />`]

  let desc = `${sp}${node.type} "${node.name}" ${w}x${h}${pos}`

  // Layout
  if (node.layoutMode) {
    const parts = [node.layoutMode === 'HORIZONTAL' ? 'row' : 'col']
    if (node.itemSpacing) parts.push(`gap:${Math.round(node.itemSpacing)}`)
    const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].filter(Boolean)
    if (pad.length) parts.push(`pad:${pad.map(Math.round)}`)
    if (node.primaryAxisAlignItems) parts.push(`align:${node.primaryAxisAlignItems}`)
    if (node.counterAxisAlignItems) parts.push(`cross:${node.counterAxisAlignItems}`)
    desc += ` [${parts.join(' ')}]`
  }

  // Visual
  for (const f of visible(node.fills)) {
    if (f.type === 'SOLID') desc += ` bg:${hex(f.color, f.opacity)}`
    else if (f.type === 'IMAGE') desc += ` img:${f.imageRef?.slice(0, 12)}...`
    else if (f.type?.includes('GRADIENT')) desc += ` gradient`
  }
  const strokes = visible(node.strokes)
  if (strokes.length) desc += ` border:${hex(strokes[0].color)}/${node.strokeWeight}px`
  if (node.cornerRadius) desc += ` rounded:${node.cornerRadius}px`
  if (node.effects?.some((e) => e.visible !== false && e.type === 'DROP_SHADOW')) desc += ` shadow`
  if (node.opacity != null && node.opacity < 1) desc += ` opacity:${node.opacity}`
  if (node.clipsContent) desc += ` clip`

  // Text
  if (node.type === 'TEXT' && node.characters) {
    const s = node.style || {}
    const cls = textDesignClass(s.fontSize, s.fontWeight)
    desc += ` "${node.characters}" ${cls} (${s.fontFamily}/${s.fontSize}px/${s.fontWeight})`
    if (s.textAlignHorizontal && s.textAlignHorizontal !== 'LEFT') desc += ` align:${s.textAlignHorizontal}`
    const solidFill = visible(node.fills).find((f) => f.type === 'SOLID')
    if (solidFill) desc += ` color:${hex(solidFill.color, solidFill.opacity)}`
  }

  // Component match
  const match = mapFigmaToComponents(node, 0, [])[0]
  if (match) desc += ` → <${match.comp}>`

  lines.push(desc)
  for (const child of visible(node.children)) lines.push(...describeNode(child, b, depth + 1))
  return lines
}
