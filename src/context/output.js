import { COMPONENT_MAP } from '../design/components.js'
import { textDesignClass } from '../design/text.js'

export function buildComponentSection(matches) {
  const byComp = {}
  for (const m of matches) (byComp[m.comp] ||= []).push(m.name)
  const imports = [...new Set(matches.map((m) => COMPONENT_MAP[m.comp]?.import).filter(Boolean))]

  let out = `## Vue Component Mapping (${matches.length} matches)\n\n`
  for (const [comp, nodes] of Object.entries(byComp)) {
    const c = COMPONENT_MAP[comp]
    out += `### ${comp} (${nodes.length}x)\n`
    out += `Import: ${c?.import}\nExample: ${c?.ex}\n`
    if (c?.props) out += `Props: ${Object.entries(c.props).map(([k, v]) => `${k}:${v.type}${v.options ? `[${v.options}]` : ''}`).join(', ')}\n`
    if (c?.slots?.length) out += `Slots: ${c.slots.join(', ')}\n`
    out += `Nodes: ${nodes.slice(0, 5).join(', ')}${nodes.length > 5 ? ` (+${nodes.length - 5} more)` : ''}\n\n`
  }
  out += `All imports:\n${imports.join('\n')}\n\n`
  return out
}

export function buildTextSection(texts) {
  let out = `## Text Content (${texts.length} elements)\n\n`
  for (const t of texts) {
    out += `- "${t.text}" → \`${textDesignClass(t.size, t.weight)}\` (${t.font}/${t.size}px/${t.weight}) ${t.color || ''}\n`
  }
  return out + '\n'
}

export function buildImageSection(images, urlMap, pancakeUrlMap = {}) {
  let out = `## Image Assets (${images.length})\n\n`
  for (const img of images) {
    const figmaUrl = urlMap[img.ref]
    const pancakeUrl = figmaUrl && pancakeUrlMap[figmaUrl]
    out += `- "${img.name}" ${img.w}x${img.h} at(${img.x},${img.y})\n`
    if (pancakeUrl) {
      out += `  src: ${pancakeUrl}\n`
    } else if (figmaUrl) {
      out += `  url: ${figmaUrl}\n`
    }
    out += `  ref: ${img.ref}\n`
  }
  return out + '\n'
}
