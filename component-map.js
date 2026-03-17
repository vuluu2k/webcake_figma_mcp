const DS = '@/components/design'

const p = (type, opts) => {
  if (typeof opts === 'string') return { type, default: opts }
  if (Array.isArray(opts)) return { type, options: opts }
  return { type, ...opts }
}

const S = (type, opts) => p('String', opts || type)
const B = () => ({ type: 'Boolean' })
const N = (def) => p('Number', def)
const VM = (type) => ({ type, vModel: true })

export const COMPONENT_MAP = {
  Button: {
    props: {
      label: p('String|Number'),
      type: S(['primary', 'secondary', 'gray', 'info', 'warning', 'black', 'gold', 'error', 'danger', 'neutral']),
      size: S(['xs', 'sm', 'md', 'lg']),
      loading: B(), danger: B(), ghost: B(), disabled: B(),
    },
    slots: ['default', 'icon', 'suffix'],
    ex: '<Button type="primary" label="Click me" />',
  },
  Input: {
    props: {
      value: VM('String|Number'), placeholder: S(), size: S(['xs', 'sm', 'md', 'lg']),
      label: S(), isError: B(), message: p('String|Boolean'), disabled: B(), allowClear: B(), isNumber: B(), require: B(),
    },
    slots: ['prefix', 'suffix'],
    ex: '<Input v-model:value="form.name" label="Name" placeholder="Enter name" />',
  },
  InputSearch: {
    props: { value: VM('String|Number'), placeholder: S(), loading: B(), display: S(['primary', 'secondary']) },
    ex: '<InputSearch v-model:value="search" placeholder="Search..." />',
  },
  InputMoney: {
    props: { value: VM('String|Number'), size: S(['xs', 'sm', 'md', 'lg', 'xl']), currency: S("'VND'"), suffix: S(), useFormat: B() },
    slots: ['addonAfter'],
    ex: '<InputMoney v-model:value="price" currency="VND" />',
  },
  InputWeight: {
    props: { value: VM('String|Number'), size: S(['xs', 'sm', 'md', 'lg', 'xl']) },
    slots: ['addonAfter'],
    ex: '<InputWeight v-model:value="weight" />',
  },
  InputPhoneCountry: {
    props: { countryValue: { type: 'String', default: "'VN'", vModel: true } },
    ex: '<InputPhoneCountry v-model:countryValue="country" />',
  },
  InputWithTag: {
    props: { value: VM('String'), specialValues: p('Array'), placeholder: S() },
    ex: '<InputWithTag v-model:value="tags" />',
  },
  TextArea: {
    props: { value: VM('String|Number'), placeholder: S(), size: S(['sm', 'md', 'lg']), label: S(), isError: B(), message: p('String|Boolean'), disabled: B() },
    ex: '<TextArea v-model:value="desc" label="Description" />',
  },
  Select: {
    props: {
      value: VM('String|Number|Array'), options: { type: 'Array', required: true }, title: S(),
      size: S(['sm', 'md', 'lg']), sKey: S("'key'"), sValue: S("'value'"),
      mode: S(['multiple', 'single', 'tags']), disabled: B(), loading: B(),
    },
    slots: ['suffixIcon', 'option', 'default', 'dropdownRender', 'tagRender', 'notFoundContent'],
    ex: '<Select v-model:value="selected" :options="options" title="Category" />',
  },
  AutoComplete: {
    props: { options: p('Array'), sKey: S("'key'"), sValue: S("'value'"), title: S() },
    ex: '<AutoComplete :options="suggestions" title="Search" />',
  },
  Cascader: {
    props: { options: p('Array') },
    ex: '<Cascader :options="cascaderOptions" @change="onChange" />',
  },
  TreeSelect: {
    props: { title: S(), size: S(['sm', 'md', 'lg']), disabled: B(), multiple: B() },
    ex: '<TreeSelect title="Category" multiple />',
  },
  Dropdown: {
    props: {
      visible: VM('Boolean'), options: p('Array'),
      trigger: p('Array', ['click', 'hover', 'contextmenu']),
      placement: S(['bottomLeft', 'bottom', 'bottomRight', 'topLeft', 'top', 'topRight']),
      size: S(['sm', 'md', 'lg']),
    },
    slots: ['default', 'overlay', 'extra'],
    ex: '<Dropdown :options="menuItems" :trigger="[\'click\']"><Button>Menu</Button></Dropdown>',
  },
  DropdownFilter: {
    props: { value: VM('Array'), label: S(), options: p('Array') },
    ex: '<DropdownFilter v-model:value="filters" label="Filter" :options="filterOptions" />',
  },
  Popover: {
    props: { options: p('Array'), maxHeight: p('Number|String'), minWidth: p('Number|String'), useArrow: B() },
    slots: ['default', 'title', 'content'],
    ex: '<Popover :options="items"><Button>Open</Button></Popover>',
  },
  Checkbox: {
    props: { checked: VM('Boolean'), label: S(), disabled: B(), indeterminate: B(), size: S(['sm', 'md', 'lg']) },
    ex: '<Checkbox v-model:checked="agreed" label="I agree" />',
  },
  CheckboxGroup: {
    props: { value: VM('Array'), options: p('Array'), direction: S(['horizontal', 'vertical']), useAll: B() },
    ex: '<CheckboxGroup v-model:value="selected" :options="options" direction="vertical" />',
  },
  Radio: {
    props: { label: S(), disabled: B() },
    slots: ['default', 'more'],
    ex: '<Radio label="Option A" />',
  },
  RadioGroup: {
    props: { options: p('Array'), direction: S(['horizontal', 'vertical']) },
    slots: ['default', 'option'],
    ex: '<RadioGroup :options="options" direction="horizontal" />',
  },
  RadioGroupButton: {
    props: { options: p('Array'), direction: S(['horizontal', 'vertical']) },
    ex: '<RadioGroupButton :options="options" />',
  },
  Switch: {
    props: { checked: VM('Boolean'), label: S(), subLabel: S(), size: S(['sm', 'md']), disabled: B() },
    ex: '<Switch v-model:checked="enabled" label="Enable" />',
  },
  Table: {
    props: { columns: { type: 'Array', required: true }, loading: B(), rowSelection: p('Object'), scroll: p('Object'), bordered: p('Boolean', 'true'), height: p('String|Number') },
    slots: ['headerCell', 'bodyCell', 'expandedRowRender', 'emptyText'],
    ex: '<Table :columns="columns" :loading="loading"><template #bodyCell="{ column, record }">...</template></Table>',
  },
  TableV2: {
    props: { columns: p('Array'), dataSource: p('Array'), rowSelection: p('Object'), loading: B(), pagination: p('Object') },
    slots: ['bodyCell', 'column', 'sort'],
    ex: '<TableV2 :columns="columns" :dataSource="data" :loading="loading" />',
  },
  DraggableTable: {
    props: { data: { type: 'Array', required: true }, columns: { type: 'Array', required: true }, loading: B(), rowHeight: N('58') },
    slots: ['bodyCell', 'actionCell'],
    ex: '<DraggableTable :data="items" :columns="columns" @dragEnd="onDrag" />',
  },
  Tags: {
    props: { size: S(['sm', 'md', 'lg']), type: S(['secondary', 'primary', 'info', 'success', 'warning', 'error', 'pink', 'purple']), bordered: B(), closable: B() },
    slots: ['default', 'icon'],
    ex: '<Tags type="success" size="md">Active</Tags>',
  },
  TagSelect: {
    props: { active: B() },
    slots: ['default'],
    ex: '<TagSelect :active="isActive">Label</TagSelect>',
  },
  Badge: {
    props: { count: N(), type: S(['secondary', 'primary', 'positive', 'info', 'success', 'warning', 'error']), ghost: B(), dot: B(), size: S(['sm', 'md']), showZero: B() },
    slots: ['default'],
    ex: '<Badge :count="5" type="error"><Avatar :src="url" /></Badge>',
  },
  Status: {
    props: { type: S(['success', 'secondary', 'info', 'warning', 'error']), size: p('String|Number', '8'), color: S() },
    ex: '<Status type="success" />',
  },
  Avatar: {
    props: { src: S(), size: N('32'), online: B(), useOnline: B() },
    slots: ['icon', 'iconOnline'],
    ex: '<Avatar :src="user.avatar" :size="40" />',
  },
  AvatarGroup: { ex: '<AvatarGroup>...</AvatarGroup>' },
  Image: {
    props: { src: { type: 'String', required: true }, alt: S(), width: N(), height: N(), fixedSize: B() },
    ex: '<Image :src="imageUrl" :width="200" :height="150" alt="Product" />',
  },
  Tabs: {
    props: { options: p('Array'), size: S(['sm', 'md', 'lg']), bordered: B() },
    slots: ['default', 'tab', 'tabPane'],
    ex: '<Tabs :options="tabOptions" size="md" />',
  },
  TabsV2: {
    props: { options: p('Array'), activeKey: VM('String'), size: S(['md', 'sm']) },
    slots: ['default', 'icon', 'value'],
    ex: '<TabsV2 v-model:activeKey="activeTab" :options="tabs" />',
  },
  Segmented: {
    props: { value: VM('String|Number'), options: p('Array'), size: S(['xs', 'sm', 'md', 'lg']), type: S(['primary', 'secondary', 'primary_v2']) },
    ex: '<Segmented v-model:value="view" :options="viewOptions" type="primary" />',
  },
  Segment: {
    props: { value: VM('String|Number'), options: p('Array'), size: S(['sm', 'md', 'lg']), isToggle: B() },
    ex: '<Segment v-model:value="mode" :options="modes" />',
  },
  Sidebar: {
    props: { value: VM('String|Number'), options: p('Array'), label: S() },
    ex: '<Sidebar v-model:value="activeMenu" :options="menuOptions" label="Settings" />',
  },
  Pagination: {
    props: { current: VM('Number'), pageSize: VM('Number'), total: N(), size: S(['sm', 'md']), showSizeChanger: B() },
    ex: '<Pagination v-model:current="page" v-model:pageSize="pageSize" :total="total" />',
  },
  Steps: {
    props: { options: p('Array'), size: S(['sm', 'md', 'lg']) },
    ex: '<Steps :options="stepOptions" size="md" />',
  },
  Typography: {
    props: { variant: S(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'body-sm', 'footnote', 'footnote-sm', 'input', 'link']), component: S("'div'"), weight: S(['light', 'regular', 'medium', 'semi-bold', 'bold']) },
    slots: ['default'],
    ex: '<Typography variant="h3" weight="semi-bold">Title</Typography>',
  },
  Modal: {
    props: { visible: VM('Boolean'), title: S(), cancelText: S(), okText: S(), confirmLoading: B(), centered: B(), hiddenCancel: B(), hiddenOk: B() },
    slots: ['default', 'closeIcon', 'footer', 'footerLeft', 'footerRight', 'title'],
    ex: '<Modal v-model:visible="showModal" title="Confirm" @ok="handleOk">Content</Modal>',
  },
  ModalConfirm: {
    props: { visible: VM('Boolean'), title: S(), content: p('String|Object'), type: S(['primary', 'warning', 'info', 'error', 'danger']), okText: S(), cancelText: S(), confirmLoading: B() },
    slots: ['default', 'icon', 'title', 'content', 'action'],
    ex: '<ModalConfirm v-model:visible="show" type="danger" title="Delete?" @ok="onDelete" />',
  },
  Drawer: {
    props: { title: S(), hiddenCancel: B(), hiddenOk: B(), confirmLoading: B(), cancelText: S(), okText: S() },
    slots: ['default', 'title', 'footer', 'footerLeft', 'footerRight'],
    ex: '<Drawer v-model:visible="showDrawer" title="Details" @ok="save">Content</Drawer>',
  },
  Alert: {
    props: { type: S(['info', 'warning', 'error']), title: S(), subTitle: S(), buttonText: S() },
    slots: ['icon', 'buttonPrefix', 'buttonSuffix'],
    ex: '<Alert type="warning" title="Warning" subTitle="Check your input" />',
  },
  Tooltip: {
    slots: ['default', 'title'],
    ex: '<Tooltip><template #title>Tooltip text</template><Button>Hover</Button></Tooltip>',
  },
  Progress: {
    props: { type: S() },
    ex: '<Progress type="line" />',
  },
  Wrapper: {
    props: { type: S(['white', 'gray']) },
    slots: ['default'],
    ex: '<Wrapper type="white">Content</Wrapper>',
  },
  CardTitle: {
    slots: ['default', 'icon', 'title', 'action'],
    ex: '<CardTitle><template #title>Section</template>Content</CardTitle>',
  },
  CardOverview: {
    props: { label: S() },
    slots: ['default', 'icon'],
    ex: '<CardOverview label="Total Orders">1,234</CardOverview>',
  },
  Divider: {
    props: { direction: S(['horizontal', 'vertical']), height: N(), width: N(), space: N() },
    ex: '<Divider direction="horizontal" />',
  },
  Empty: {
    props: { size: N('97'), label: S() },
    ex: '<Empty label="No data found" />',
  },
  ImageUpload: {
    props: { value: VM('String'), size: N('80'), showPreview: p('Boolean', 'true'), showDelete: p('Boolean', 'true'), title: S() },
    ex: '<ImageUpload v-model:value="imageUrl" title="Upload" />',
  },
  UploadThumbnail: {
    props: { src: S(), alt: S("'thumbnail'") },
    slots: ['default', 'icon'],
    ex: '<UploadThumbnail :src="thumb" @remove="onRemove" />',
  },
  DatePicker: {
    props: { value: VM('String'), classes: S() },
    ex: '<DatePicker v-model:value="date" />',
  },
  RangePicker: {
    slots: ['default', 'suffixIcon', 'separator'],
    ex: '<RangePicker v-model:value="dateRange" />',
  },
  Slider: { ex: '<Slider v-model:value="val" />' },
  Creator: {
    props: { fullName: S(), firstName: S(), lastName: S(), email: S() },
    ex: '<Creator fullName="John" email="john@ex.com" />',
  },
}

// Auto-generate import statements
for (const [name, comp] of Object.entries(COMPONENT_MAP)) {
  comp.import = `import ${name} from '${DS}/${name}.vue'`
}

// Pre-compile matching rules — regex created once at startup
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
  for (const rule of RULES) {
    if (rule.test(name, node.type)) return rule.comp
  }
  return null
}

export function mapFigmaToComponents(node, depth = 0, results = []) {
  const comp = matchNode(node)
  if (comp) {
    results.push({
      id: node.id,
      name: node.name,
      type: node.type,
      comp,
      depth,
    })
  }
  if (node.children) {
    for (const child of node.children) {
      mapFigmaToComponents(child, depth + 1, results)
    }
  }
  return results
}

export const CATEGORIES = {
  buttons: ['Button'],
  inputs: ['Input', 'InputSearch', 'InputMoney', 'InputWeight', 'InputPhoneCountry', 'InputWithTag', 'TextArea'],
  select: ['Select', 'AutoComplete', 'Cascader', 'TreeSelect', 'Dropdown', 'DropdownFilter', 'Popover'],
  checkbox: ['Checkbox', 'CheckboxGroup', 'Radio', 'RadioGroup', 'RadioGroupButton', 'Switch'],
  data: ['Table', 'TableV2', 'DraggableTable', 'Tags', 'TagSelect', 'Badge', 'Status', 'Avatar', 'AvatarGroup', 'Image', 'Progress', 'Steps', 'Slider'],
  navigation: ['Tabs', 'TabsV2', 'Segmented', 'Segment', 'Sidebar', 'Pagination'],
  feedback: ['Modal', 'ModalConfirm', 'Drawer', 'Alert', 'Tooltip'],
  layout: ['Wrapper', 'CardTitle', 'CardOverview', 'Divider', 'Empty'],
  upload: ['ImageUpload', 'UploadThumbnail'],
  typography: ['Typography'],
}
