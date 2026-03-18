// Maps Figma font size/weight → text-design-{level}-{weight} CSS class
// Source: src/style/view/design/text_design.scss

const LEVELS = [[48, 'h0'], [38, 'h1'], [30, 'h2'], [24, 'h3'], [20, 'h4'], [16, 'h5'], [14, 'body'], [13, 'body-sm'], [12, 'footnote'], [0, 'footnote-sm']]
const WEIGHTS = [[700, 'bold'], [600, 'semibold'], [500, 'medium'], [400, 'regular'], [300, 'light']]

export function textDesignClass(size, weight) {
  const lvl = (size && LEVELS.find(([min]) => size >= min)?.[1]) || 'body'
  const wt = (weight && WEIGHTS.find(([min]) => weight >= min)?.[1]) || 'regular'
  return `text-design-${lvl}-${wt}`
}
