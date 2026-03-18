import { hex, visible } from '../utils.js'
import { textDesignClass } from '../design/text.js'
import { mapFigmaToComponents } from '../design/matcher.js'

// Check if node tree contains text or images (worth keeping)
function hasContent(node) {
  if (node.type === 'TEXT' && node.characters) return true
  if (node.fills?.some((f) => f.visible !== false && f.type === 'IMAGE')) return true
  if (node.type === 'INSTANCE') return true
  if (node.children) return visible(node.children).some(hasContent)
  return false
}

function isVectorOnly(node) {
  if (node.type === 'VECTOR') return true
  if (node.type === 'GROUP' && node.children) {
    return visible(node.children).every(isVectorOnly)
  }
  return false
}

export function describeNode(node, parentBounds, depth = 0) {
  const sp = '  '.repeat(depth)
  const lines = []
  const b = node.absoluteBoundingBox
  const w = b ? Math.round(b.width) : 0
  const h = b ? Math.round(b.height) : 0
  const relX = b && parentBounds ? Math.round(b.x - parentBounds.x) : 0
  const relY = b && parentBounds ? Math.round(b.y - parentBounds.y) : 0
  const pos = b && parentBounds ? ` at (${relX}, ${relY})` : ''

  // Blurred ellipses → decorative bg effect, but still traverse children for content
  if (node.type === 'ELLIPSE' && node.effects?.some((e) => e.visible !== false && /BLUR/.test(e.type))) {
    const blur = node.effects.find((e) => e.visible !== false && /BLUR/.test(e.type))
    const colors = []
    for (const f of visible(node.fills)) {
      if (f.type === 'SOLID') colors.push(hex(f.color, f.opacity))
      else if (f.gradientStops) f.gradientStops.forEach((s) => colors.push(hex(s.color)))
    }
    const bg = colors.length >= 2 ? `(${colors.join(' → ')})` : colors[0] || ''
    lines.push(`${sp}[bg-effect] ELLIPSE "${node.name}" ${w}x${h}${pos} gradient${bg} blur:${blur?.radius || 0}px`)
    return lines
  }

  // VECTOR nodes → mention as SVG (don't silently skip)
  if (node.type === 'VECTOR') {
    const imgFill = node.fills?.find((f) => f.visible !== false && f.type === 'IMAGE')
    if (imgFill) {
      lines.push(`${sp}IMAGE "${node.name}" ${w}x${h}${pos} img:${imgFill.imageRef}`)
    } else {
      // SVG vector — mention it so Claude knows it exists
      lines.push(`${sp}SVG "${node.name}" ${w}x${h}${pos} → export_nodes(node_id="${node.id}")`)
    }
    return lines
  }

  // GROUP of pure vectors (no text/images inside) → single illustration line
  if (node.type === 'GROUP' && node.children && isVectorOnly(node) && !hasContent(node)) {
    lines.push(`${sp}[illustration] "${node.name}" ${w}x${h}${pos} → export_nodes(node_id="${node.id}")`)
    return lines
  }

  // LINE
  if (node.type === 'LINE') {
    const stroke = visible(node.strokes)[0]
    const color = stroke ? ` color:${hex(stroke.color)}` : ''
    lines.push(`${sp}LINE "${node.name}" ${w}x${h}${pos}${color}`)
    return lines
  }

  // TEXT
  if (node.type === 'TEXT' && node.characters) {
    const s = node.style || {}
    const cls = textDesignClass(s.fontSize, s.fontWeight)
    const solidFill = visible(node.fills).find((f) => f.type === 'SOLID')
    const color = solidFill ? ` color:${hex(solidFill.color, solidFill.opacity)}` : ''
    const align = s.textAlignHorizontal && s.textAlignHorizontal !== 'LEFT' ? ` align:${s.textAlignHorizontal}` : ''
    lines.push(`${sp}TEXT "${node.characters}" ${w}x${h}${pos} ${cls}${color}${align}`)
    return lines
  }

  // RECTANGLE / ELLIPSE with fills
  if ((node.type === 'RECTANGLE' || node.type === 'ELLIPSE') && !node.children?.length) {
    const imgFill = node.fills?.find((f) => f.visible !== false && f.type === 'IMAGE')
    if (imgFill) {
      lines.push(`${sp}IMAGE "${node.name}" ${w}x${h}${pos} img:${imgFill.imageRef}`)
    } else {
      let style = ''
      for (const f of visible(node.fills)) {
        if (f.type === 'SOLID') style += ` bg:${hex(f.color, f.opacity)}`
        else if (f.type?.includes('GRADIENT')) style += ' gradient'
      }
      if (node.cornerRadius) style += ` rounded:${node.cornerRadius}px`
      if (node.type === 'ELLIPSE') style += ' rounded-full'
      if (style) lines.push(`${sp}SHAPE "${node.name}" ${w}x${h}${pos}${style}`)
    }
    return lines
  }

  // Build description for containers
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

  // Visual properties
  for (const f of visible(node.fills)) {
    if (f.type === 'SOLID') desc += ` bg:${hex(f.color, f.opacity)}`
    else if (f.type === 'IMAGE') desc += ` img:${f.imageRef?.slice(0, 12)}...`
    else if (f.type?.includes('GRADIENT')) desc += ' gradient'
  }
  const strokes = visible(node.strokes)
  if (strokes.length) desc += ` border:${hex(strokes[0].color)}/${node.strokeWeight}px`
  if (node.cornerRadius) desc += ` rounded:${node.cornerRadius}px`
  if (node.effects?.some((e) => e.visible !== false && e.type === 'DROP_SHADOW')) desc += ' shadow'
  if (node.opacity != null && node.opacity < 1) desc += ` opacity:${node.opacity}`

  // Component match
  const match = mapFigmaToComponents(node, 0, [])[0]
  if (match) desc += ` → <${match.comp}>`

  lines.push(desc)

  // Always traverse children — never skip content
  for (const child of visible(node.children)) {
    lines.push(...describeNode(child, b, depth + 1))
  }

  return lines
}
