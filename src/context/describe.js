import { hex, visible } from '../utils.js'
import { textDesignClass } from '../design/text.js'
import { mapFigmaToComponents } from '../design/matcher.js'

function hasContent(node) {
  if (node.type === 'TEXT' && node.characters) return true
  if (node.fills?.some((f) => f.visible !== false && f.type === 'IMAGE')) return true
  if (node.type === 'INSTANCE') return true
  if (node.children) return visible(node.children).some(hasContent)
  return false
}

function isVectorOnly(node) {
  if (node.type === 'VECTOR') return true
  if (node.type === 'GROUP' && node.children) return visible(node.children).every(isVectorOnly)
  return false
}

// ===== Dev-mode style extractors =====

function cssGradient(fill) {
  if (!fill.gradientStops?.length) return 'gradient'
  const stops = fill.gradientStops.map((s) => {
    const color = hex(s.color)
    const pct = Math.round(s.position * 100)
    return `${color} ${pct}%`
  })
  // Compute angle from gradientHandlePositions
  let angle = 180
  if (fill.gradientHandlePositions?.length >= 2) {
    const [p0, p1] = fill.gradientHandlePositions
    angle = Math.round(Math.atan2(p1.y - p0.y, p1.x - p0.x) * 180 / Math.PI + 90)
    if (angle < 0) angle += 360
  }
  return `linear-gradient(${angle}deg, ${stops.join(', ')})`
}

function cssShadow(effect) {
  const x = Math.round(effect.offset?.x || 0)
  const y = Math.round(effect.offset?.y || 0)
  const blur = Math.round(effect.radius || 0)
  const spread = Math.round(effect.spread || 0)
  const color = hex(effect.color) || 'rgba(0,0,0,0.25)'
  return `${x}px ${y}px ${blur}px ${spread}px ${color}`
}

function sizingMode(node) {
  const parts = []
  // primaryAxisSizingMode: FIXED or AUTO (hug)
  // counterAxisSizingMode: FIXED or AUTO (hug)
  if (node.primaryAxisSizingMode === 'AUTO') parts.push('h:hug')
  if (node.counterAxisSizingMode === 'AUTO') parts.push('w:hug')
  // layoutAlign on child: STRETCH = fill parent
  if (node.layoutAlign === 'STRETCH') parts.push('fill')
  // layoutGrow: 1 = flex-grow
  if (node.layoutGrow === 1) parts.push('grow')
  return parts.length ? parts.join(' ') : null
}

function textCSS(style) {
  const parts = []
  if (style.lineHeightPx) parts.push(`lh:${Math.round(style.lineHeightPx)}px`)
  if (style.letterSpacing && style.letterSpacing !== 0) parts.push(`ls:${style.letterSpacing.toFixed(1)}px`)
  if (style.textDecoration === 'UNDERLINE') parts.push('underline')
  if (style.textDecoration === 'STRIKETHROUGH') parts.push('line-through')
  if (style.textCase === 'UPPER') parts.push('uppercase')
  if (style.textCase === 'LOWER') parts.push('lowercase')
  return parts.join(' ')
}

function fillsDesc(node) {
  const parts = []
  for (const f of visible(node.fills)) {
    if (f.type === 'SOLID') parts.push(`bg:${hex(f.color, f.opacity)}`)
    else if (f.type === 'IMAGE') parts.push(`img:${f.imageRef}`)
    else if (f.type?.includes('GRADIENT')) parts.push(`bg:${cssGradient(f)}`)
  }
  return parts.join(' ')
}

function effectsDesc(node) {
  const parts = []
  for (const e of visible(node.effects)) {
    if (e.type === 'DROP_SHADOW') parts.push(`shadow(${cssShadow(e)})`)
    else if (e.type === 'INNER_SHADOW') parts.push(`inner-shadow(${cssShadow(e)})`)
    else if (e.type === 'LAYER_BLUR') parts.push(`blur:${e.radius}px`)
    else if (e.type === 'BACKGROUND_BLUR') parts.push(`backdrop-blur:${e.radius}px`)
  }
  return parts.join(' ')
}

function commonStyles(node) {
  const parts = []
  const f = fillsDesc(node)
  if (f) parts.push(f)
  const strokes = visible(node.strokes)
  if (strokes.length) parts.push(`border:${node.strokeWeight || 1}px ${hex(strokes[0].color)}`)
  if (node.cornerRadius) parts.push(`rounded:${Math.round(node.cornerRadius)}px`)
  else if (node.rectangleCornerRadii) parts.push(`rounded:${node.rectangleCornerRadii.map(Math.round).join(',')}px`)
  const fx = effectsDesc(node)
  if (fx) parts.push(fx)
  if (node.opacity != null && node.opacity < 1) parts.push(`opacity:${node.opacity.toFixed(2)}`)
  return parts.join(' ')
}

// ===== Main describe =====

export function describeNode(node, parentBounds, depth = 0) {
  const sp = '  '.repeat(depth)
  const lines = []
  const b = node.absoluteBoundingBox
  const w = b ? Math.round(b.width) : 0
  const h = b ? Math.round(b.height) : 0
  const relX = b && parentBounds ? Math.round(b.x - parentBounds.x) : 0
  const relY = b && parentBounds ? Math.round(b.y - parentBounds.y) : 0
  const pos = b && parentBounds ? ` at(${relX},${relY})` : ''

  // Blurred ellipses → bg effect with full gradient CSS
  if (node.type === 'ELLIPSE' && node.effects?.some((e) => e.visible !== false && /BLUR/.test(e.type))) {
    const blur = node.effects.find((e) => e.visible !== false && /BLUR/.test(e.type))
    const gradient = visible(node.fills).find((f) => f.gradientStops)
    const bg = gradient ? cssGradient(gradient) : fillsDesc(node)
    lines.push(`${sp}[bg-effect] "${node.name}" ${w}x${h}${pos} ${bg} blur:${blur?.radius || 0}px`)
    return lines
  }

  // VECTOR → SVG with styles
  if (node.type === 'VECTOR') {
    const imgFill = node.fills?.find((f) => f.visible !== false && f.type === 'IMAGE')
    if (imgFill) {
      lines.push(`${sp}IMAGE "${node.name}" ${w}x${h}${pos} img:${imgFill.imageRef}`)
    } else {
      const styles = commonStyles(node)
      lines.push(`${sp}SVG "${node.name}" ${w}x${h}${pos}${styles ? ' ' + styles : ''} → export_nodes(node_id="${node.id}")`)
    }
    return lines
  }

  // Pure vector GROUP → illustration
  if (node.type === 'GROUP' && node.children && isVectorOnly(node) && !hasContent(node)) {
    lines.push(`${sp}[illustration] "${node.name}" ${w}x${h}${pos} → export_nodes(node_id="${node.id}")`)
    return lines
  }

  // LINE
  if (node.type === 'LINE') {
    const stroke = visible(node.strokes)[0]
    lines.push(`${sp}LINE "${node.name}" ${w}x${h}${pos} ${stroke ? `${node.strokeWeight || 1}px ${hex(stroke.color)}` : ''}`)
    return lines
  }

  // TEXT — full dev-mode info
  if (node.type === 'TEXT' && node.characters) {
    const s = node.style || {}
    const cls = textDesignClass(s.fontSize, s.fontWeight)
    const solidFill = visible(node.fills).find((f) => f.type === 'SOLID')
    const color = solidFill ? ` color:${hex(solidFill.color, solidFill.opacity)}` : ''
    const align = s.textAlignHorizontal && s.textAlignHorizontal !== 'LEFT' ? ` align:${s.textAlignHorizontal}` : ''
    const extra = textCSS(s)
    const fx = effectsDesc(node)
    lines.push(`${sp}TEXT "${node.characters}" ${w}x${h}${pos} ${cls} ${s.fontFamily}/${s.fontSize}px/${s.fontWeight}${color}${align}${extra ? ' ' + extra : ''}${fx ? ' ' + fx : ''}`)
    return lines
  }

  // RECTANGLE / ELLIPSE leaf
  if ((node.type === 'RECTANGLE' || node.type === 'ELLIPSE') && !visible(node.children).length) {
    const imgFill = node.fills?.find((f) => f.visible !== false && f.type === 'IMAGE')
    if (imgFill) {
      const fx = effectsDesc(node)
      lines.push(`${sp}IMAGE "${node.name}" ${w}x${h}${pos} img:${imgFill.imageRef}${fx ? ' ' + fx : ''}`)
    } else {
      const styles = commonStyles(node)
      if (node.type === 'ELLIPSE') {
        lines.push(`${sp}ELLIPSE "${node.name}" ${w}x${h}${pos}${styles ? ' ' + styles : ''}`)
      } else if (styles) {
        lines.push(`${sp}SHAPE "${node.name}" ${w}x${h}${pos} ${styles}`)
      }
    }
    return lines
  }

  // INSTANCE — show component name + variant properties
  if (node.type === 'INSTANCE') {
    let desc = `${sp}INSTANCE "${node.name}" ${w}x${h}${pos}`
    if (node.componentProperties) {
      const props = Object.entries(node.componentProperties)
        .map(([k, v]) => `${k}=${v.value}`)
        .join(' ')
      if (props) desc += ` [${props}]`
    }
    const styles = commonStyles(node)
    if (styles) desc += ` ${styles}`
    const match = mapFigmaToComponents(node, 0, [])[0]
    if (match) desc += ` → <${match.comp}>`
    lines.push(desc)
    for (const child of visible(node.children)) lines.push(...describeNode(child, b, depth + 1))
    return lines
  }

  // Container (FRAME / GROUP / COMPONENT)
  let desc = `${sp}${node.type} "${node.name}" ${w}x${h}${pos}`

  // Layout — dev-mode detail
  if (node.layoutMode) {
    const parts = [node.layoutMode === 'HORIZONTAL' ? 'row' : 'col']
    if (node.itemSpacing) parts.push(`gap:${Math.round(node.itemSpacing)}`)
    const pad = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft].map((v) => Math.round(v || 0))
    if (pad.some(Boolean)) parts.push(`pad:${pad.join(',')}`)
    if (node.primaryAxisAlignItems) parts.push(`align:${node.primaryAxisAlignItems}`)
    if (node.counterAxisAlignItems) parts.push(`cross:${node.counterAxisAlignItems}`)
    const sizing = sizingMode(node)
    if (sizing) parts.push(sizing)
    desc += ` [${parts.join(' ')}]`
  }

  // Styles
  const styles = commonStyles(node)
  if (styles) desc += ` ${styles}`

  // Component match
  const match = mapFigmaToComponents(node, 0, [])[0]
  if (match) desc += ` → <${match.comp}>`

  lines.push(desc)
  for (const child of visible(node.children)) lines.push(...describeNode(child, b, depth + 1))
  return lines
}
