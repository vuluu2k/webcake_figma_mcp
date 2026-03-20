// Pre-compiled regex rules: Figma node name → Vue component

const R = (pattern, comp, exclude) => {
  const re = new RegExp(pattern, 'i')
  const exRe = exclude ? new RegExp(exclude, 'i') : null
  return { test: (n) => re.test(n) && (!exRe || !exRe.test(n)), comp }
}
const RT = (pattern, comp, type) => {
  const re = new RegExp(pattern, 'i')
  return { test: (n, t) => re.test(n) && t === type, comp }
}

const RULES = [
  R('button', 'Button', 'radio|checkbox|switch|toggle'),
  RT('cta|action', 'Button', 'INSTANCE'),
  R('search.*(input|bar|field)', 'InputSearch'),
  R('(money|price|currency|amount).*(input|field)', 'InputMoney'),
  R('(weight).*(input|field)', 'InputWeight'),
  R('(phone|tel).*(input|field)', 'InputPhoneCountry'),
  R('textarea|text.?area|multiline', 'TextArea'),
  R('input|text.?field|form.?field', 'Input', 'search|money|phone|weight|tag'),
  R('autocomplete|auto.?complete', 'AutoComplete'),
  R('cascader', 'Cascader'),
  R('tree.?select', 'TreeSelect'),
  R('dropdown.?filter', 'DropdownFilter'),
  R('dropdown|menu', 'Dropdown', 'filter|select'),
  R('popover', 'Popover'),
  R('select|combobox|picker', 'Select', 'date|range|tag|color|tree'),
  R('checkbox.?group', 'CheckboxGroup'),
  R('checkbox|check.?box', 'Checkbox'),
  R('radio.?group.?button|radio.?button.?group', 'RadioGroupButton'),
  R('radio.?group', 'RadioGroup'),
  R('radio', 'Radio'),
  R('switch|toggle', 'Switch'),
  R('draggable.?table|sortable.?table', 'DraggableTable'),
  R('table', 'Table'),
  R('tabs|tab.?bar|tab.?nav', 'Tabs'),
  R('segmented|segment.?control', 'Segmented'),
  R('tag.?select', 'TagSelect'),
  R('tag|chip|label', 'Tags', 'input'),
  R('badge|count|notification.?count', 'Badge'),
  R('status.?dot|status.?indicator', 'Status'),
  R('avatar.?group', 'AvatarGroup'),
  R('avatar|profile.?pic', 'Avatar'),
  R('progress', 'Progress'),
  R('steps|stepper|wizard', 'Steps'),
  R('slider|range.?slider', 'Slider'),
  R('sidebar|side.?nav|side.?menu', 'Sidebar'),
  R('pagination|pager', 'Pagination'),
  R('modal.?confirm|confirm.?dialog|confirm.?modal', 'ModalConfirm'),
  R('modal|dialog|popup', 'Modal'),
  R('drawer|side.?panel|sheet', 'Drawer'),
  R('alert|banner|notice', 'Alert'),
  R('tooltip|hint', 'Tooltip'),
  R('card.?title|section.?title', 'CardTitle'),
  R('card.?overview|stat.?card|metric', 'CardOverview'),
  R('divider|separator|hr', 'Divider'),
  R('empty|no.?data|placeholder', 'Empty'),
  RT('wrapper|container|panel|card', 'Wrapper', 'FRAME'),
  R('upload|image.?upload|file.?upload', 'ImageUpload'),
  R('thumbnail', 'UploadThumbnail'),
  R('range.?picker|date.?range', 'RangePicker'),
  R('date.?picker|calendar', 'DatePicker'),
  R('image|photo|picture|img', 'Image', 'upload'),
]

function matchNode(node) {
  const name = node.name || ''
  // 1. Name-based matching (existing rules)
  for (const rule of RULES) {
    if (rule.test(name, node.type)) return rule.comp
  }
  // 2. Property-based matching for INSTANCE nodes (smarter: checks variant values)
  if (node.type === 'INSTANCE' && node.componentProperties) {
    for (const val of Object.values(node.componentProperties)) {
      const v = String(val.value || '')
      if (!v) continue
      for (const rule of RULES) {
        if (rule.test(v, node.type)) return rule.comp
      }
    }
  }
  return null
}

// O(N) single-pass: pre-compute all matches into a Map<nodeId, match>
export function buildMatchMap(node, depth = 0, map = new Map()) {
  const comp = matchNode(node)
  if (comp) map.set(node.id, { id: node.id, name: node.name, type: node.type, comp, depth })
  if (node.children) {
    for (const child of node.children) buildMatchMap(child, depth + 1, map)
  }
  return map
}

// Legacy: returns flat array (for tools that need array output)
export function mapFigmaToComponents(node, depth = 0, results = []) {
  const comp = matchNode(node)
  if (comp) results.push({ id: node.id, name: node.name, type: node.type, comp, depth })
  if (node.children) {
    for (const child of node.children) mapFigmaToComponents(child, depth + 1, results)
  }
  return results
}
