import { hex, visible } from '../utils.js'

export function collectText(node, results = []) {
  if (node.type === 'TEXT' && node.characters && node.visible !== false) {
    const s = node.style || {}
    const solidFill = visible(node.fills).find((f) => f.type === 'SOLID')
    results.push({ text: node.characters, font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, color: solidFill ? hex(solidFill.color) : null })
  }
  for (const child of visible(node.children)) collectText(child, results)
  return results
}

export function collectImages(node, rootBounds, results = []) {
  const imgFill = visible(node.fills).find((f) => f.type === 'IMAGE')
  if (imgFill && node.absoluteBoundingBox) {
    const b = node.absoluteBoundingBox
    results.push({
      ref: imgFill.imageRef, name: node.name,
      w: Math.round(b.width), h: Math.round(b.height),
      x: rootBounds ? Math.round(b.x - rootBounds.x) : 0,
      y: rootBounds ? Math.round(b.y - rootBounds.y) : 0,
    })
  }
  for (const child of visible(node.children)) collectImages(child, rootBounds || node.absoluteBoundingBox, results)
  return results
}
