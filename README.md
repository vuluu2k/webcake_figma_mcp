# Figma-Vue MCP Server

Custom MCP (Model Context Protocol) server cho project BuilderX. Kết nối trực tiếp với Figma API và chuyển đổi design sang **Vue 3 code** sử dụng design system components có sẵn trong `@/components/design/`.

## Tại sao không dùng Figma MCP mặc định?

Figma MCP chính thức (`mcp.figma.com`) output **React + Tailwind** — không phù hợp với project Vue 3. Server này giải quyết vấn đề đó:

| | Figma MCP (mặc định) | figma-vue (custom) |
|---|---|---|
| Output | React JSX | Vue 3 SFC (`<template>` + `<script setup>`) |
| Components | Generic HTML/React | 62 components từ `@/components/design/` |
| Props mapping | Không | Auto-detect props, slots, emits |
| Design tokens | Tailwind generic | Tailwind + project conventions |
| Layout | Flexbox generic | Tailwind classes từ Figma auto-layout |
| Typography | Raw CSS | `<Typography variant="h1..footnote-sm">` |

## Cài đặt

### 1. Install dependencies

```bash
cd mcp/figma-vue
npm install
```

### 2. Tạo Figma Access Token

1. Truy cập https://www.figma.com/developers/api#access-tokens
2. Click **"Create a new personal access token"**
3. Đặt tên (vd: `builderx-mcp`) và chọn scope:
   - `File content` (Read) — bắt buộc
   - `File metadata` (Read) — bắt buộc
4. Copy token

### 3. Cấu hình token

Mở `.mcp.json` ở root project, paste token vào:

```json
{
  "mcpServers": {
    "figma-vue": {
      "type": "stdio",
      "command": "node",
      "args": ["mcp/figma-vue/server.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "figd_PASTE_TOKEN_HERE"
      }
    }
  }
}
```

> **Lưu ý**: `.mcp.json` đã được gitignore. Token chỉ lưu local, không push lên repo.

### 4. Restart Claude Code

```bash
# Kiểm tra server đã kết nối
claude mcp list
# Expected: figma-vue: ... - ✓ Connected
```

## Tools

### `get_figma_node`

Fetch node tree từ Figma với đầy đủ thông tin layout, fills, strokes, text, effects.

```
Dùng: get_figma_node với figma_url
Input: Figma URL hoặc file key + node_id
Output: JSON node tree đã simplify
```

**Ví dụ prompt:**
```
Lấy thông tin node này: https://www.figma.com/design/ABC123/MyFile?node-id=1-2
```

---

### `get_figma_screenshot`

Lấy ảnh render (PNG/SVG/JPG) của một node. Dùng để xem visual reference trước khi code.

```
Input: figma_url, node_id (optional nếu có trong URL), scale (1-4), format
Output: URL ảnh (có thời hạn)
```

**Ví dụ prompt:**
```
Screenshot node 1-2 trong file https://www.figma.com/design/ABC123/MyFile
```

---

### `get_figma_styles`

Lấy tất cả styles (colors, text styles, effects, grids) định nghĩa trong file Figma.

```
Input: figma_url
Output: Danh sách styles với name, type (FILL/TEXT/EFFECT/GRID)
```

**Ví dụ prompt:**
```
Lấy design tokens từ file Figma này: https://www.figma.com/design/ABC123/MyFile
```

---

### `get_figma_components`

Liệt kê tất cả components trong file Figma kèm ID, tên, mô tả.

```
Input: figma_url
Output: Danh sách components
```

**Ví dụ prompt:**
```
Liệt kê components trong file Figma: https://www.figma.com/design/ABC123/MyFile
```

---

### `map_figma_to_vue`

**Tool chính** — Fetch Figma node và tự động map từng element sang Vue design system component phù hợp nhất.

```
Input: figma_url, node_id
Output: Danh sách matches với component name, import path, props, slots, example code
```

**Ví dụ prompt:**
```
Map Figma design này sang Vue components: https://www.figma.com/design/ABC123/MyFile?node-id=1-2
```

**Output mẫu:**
```json
{
  "totalMatches": 5,
  "components": [
    {
      "figmaNode": "Primary Button (1:23)",
      "vueComponent": "Button",
      "import": "import Button from '@/components/design/Button.vue'",
      "example": "<Button type=\"primary\" size=\"md\" label=\"Click me\" />",
      "availableProps": "label: String, type: String [primary|secondary|...], size: String [xs|sm|md|lg]"
    }
  ],
  "imports": ["import Button from '@/components/design/Button.vue'"]
}
```

---

### `generate_vue_code`

Fetch Figma node và generate Vue 3 SFC skeleton hoàn chỉnh với đúng imports và component usage.

```
Input: figma_url, node_id, component_name (default: FigmaComponent)
Output: Vue SFC code (.vue file content)
```

**Ví dụ prompt:**
```
Generate Vue component từ Figma node này, đặt tên ProductCard:
https://www.figma.com/design/ABC123/MyFile?node-id=1-2
```

**Output mẫu:**
```vue
<!-- ProductCard.vue -->
<template>
  <div class="flex flex-col gap-4 p-4">
    <!-- Figma: Card Header (1:10) -->
    <Typography variant="h4" weight="semi-bold">Product Title</Typography>
    <!-- Figma: Price Input (1:15) -->
    <InputMoney v-model:value="price" currency="VND" />
    <!-- Figma: Save Button (1:20) -->
    <Button type="primary" size="md" label="Click me" />
  </div>
</template>

<script setup>
  import Typography from '@/components/design/Typography.vue'
  import InputMoney from '@/components/design/InputMoney.vue'
  import Button from '@/components/design/Button.vue'
</script>
```

---

### `list_design_components`

Browse tất cả 62 design system components có sẵn, filter theo tên hoặc category.

```
Input: filter (regex), category (all|buttons|inputs|select|checkbox|data|navigation|feedback|layout|upload|typography)
Output: Danh sách components với props, slots, emits, example
```

**Ví dụ prompt:**
```
Liệt kê các input components có sẵn
Tìm component nào có prop "loading"
```

---

### `get_figma_images`

Lấy URLs download cho tất cả images/assets sử dụng trong file Figma.

```
Input: figma_url
Output: Object { imageRef: downloadUrl }
```

## Workflow đề xuất

### Cách 1: Nhanh — Paste link Figma

```
Implement UI từ Figma design này: https://www.figma.com/design/ABC123/MyFile?node-id=1-2
```

Claude sẽ tự động:
1. Gọi `map_figma_to_vue` để match components
2. Gọi `get_figma_screenshot` để xem visual
3. Gọi `generate_vue_code` để tạo skeleton
4. Hoàn thiện code với logic, state, events

### Cách 2: Chi tiết — Từng bước

```
# Bước 1: Xem cấu trúc design
Lấy node tree: https://www.figma.com/design/ABC123/MyFile?node-id=1-2

# Bước 2: Xem visual
Screenshot node này

# Bước 3: Map components
Map sang Vue components

# Bước 4: Generate code
Generate Vue component tên OrderTable
```

### Cách 3: Xem components trước

```
# Xem tất cả input components
list_design_components category=inputs

# Tìm component phù hợp
list_design_components filter="Table"
```

## Component Mapping Logic

Server tự động nhận diện Figma elements dựa trên:

1. **Tên node** — Match regex patterns (vd: node tên "Button" → `Button.vue`)
2. **Node type** — TEXT nodes → `Typography.vue`, FRAME → layout `<div>`
3. **Component instance** — Figma component instances → match theo component name
4. **Font size** — Tự động chọn Typography variant (≥32px → h1, ≥24px → h2, ...)
5. **Layout mode** — Figma auto-layout → Tailwind flex classes

### Bảng mapping chính

| Figma element chứa | → Vue component |
|---|---|
| button, cta, action | `Button` |
| input, text field, form field | `Input` |
| search + input | `InputSearch` |
| money, price, currency | `InputMoney` |
| textarea, multiline | `TextArea` |
| select, combobox | `Select` |
| dropdown, menu | `Dropdown` |
| checkbox | `Checkbox` |
| radio | `Radio` / `RadioGroup` |
| switch, toggle | `Switch` |
| table | `Table` |
| tabs, tab bar | `Tabs` |
| tag, chip, label | `Tags` |
| badge, count | `Badge` |
| avatar, profile pic | `Avatar` |
| modal, dialog, popup | `Modal` |
| drawer, side panel | `Drawer` |
| alert, banner, notice | `Alert` |
| tooltip, hint | `Tooltip` |
| pagination, pager | `Pagination` |
| card, container, panel | `Wrapper` |
| divider, separator | `Divider` |
| upload, image upload | `ImageUpload` |
| date picker, calendar | `DatePicker` |
| steps, stepper | `Steps` |
| progress | `Progress` |
| sidebar, side nav | `Sidebar` |
| segmented | `Segmented` |
| empty, no data | `Empty` |
| image, photo | `Image` |

## Cấu trúc file

```
mcp/figma-vue/
├── server.js           # MCP server (8 tools, stdio transport)
├── component-map.js    # 62 component definitions + Figma matching rules
├── package.json        # Dependencies
└── node_modules/       # @modelcontextprotocol/sdk, zod
```

## Mở rộng

### Thêm component mới

Khi thêm component mới vào `src/components/design/`, cập nhật `component-map.js`:

1. Thêm entry vào `COMPONENT_MAP`:
```js
MyComponent: {
  import: "import MyComponent from '@/components/design/MyComponent.vue'",
  props: {
    label: { type: 'String' },
    size: { type: 'String', options: ['sm', 'md', 'lg'] },
  },
  slots: ['default'],
  example: '<MyComponent label="Hello" size="md" />',
}
```

2. Thêm matching rule vào `FIGMA_TO_VUE_RULES`:
```js
{ match: (node) => matchName(node, 'my.?component|my.?widget'), component: 'MyComponent' },
```

### Debug

Chạy server trực tiếp để xem logs:

```bash
FIGMA_ACCESS_TOKEN=figd_xxx node mcp/figma-vue/server.js
# Server sẽ listen trên stdin, gửi JSON-RPC messages để test
```
