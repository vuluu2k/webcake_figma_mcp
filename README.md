# Figma-Vue MCP Server

Custom MCP server cho BuilderX — fetch Figma design → output Vue 3 code với `@/components/design/` + `text-design-*` classes + Webcake CDN images.

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/vuluu2k/webcake_figma_mcp/main/install.sh -o install.sh && bash install.sh
```

Hoặc nếu đã clone repo:

```bash
bash mcp/webcake_figma_mcp/install.sh
```

Script tự động:
- Install dependencies
- Hỏi tokens (Figma + Webcake)
- Chọn editors để cấu hình: **Claude Code**, **Cursor**, **VS Code**, **Windsurf**, **Antigravity**, **Codex CLI**
- Tạo config file đúng format cho từng editor
- Verify server

## Manual Install

```bash
cd mcp/webcake_figma_mcp && npm install
```

Tạo config cho editor (chọn 1):

**Claude Code** — `.mcp.json`:
```json
{
  "mcpServers": {
    "webcake_figma_mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["mcp/webcake_figma_mcp/server.js"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "",
        "WEBCAKE_JWT": "",
        "WEBCAKE_SESSION_ID": ""
      }
    }
  }
}
```

**Cursor** — `.cursor/mcp.json`: format giống trên

**VS Code** — `.vscode/mcp.json`: dùng key `"servers"` thay `"mcpServers"`

**Windsurf** — `~/.codeium/windsurf/mcp_config.json`: format giống Claude Code

**Antigravity** — `~/.gemini/antigravity/mcp_config.json`: format giống Claude Code

### Tokens

| Env | Lấy từ | Bắt buộc |
|---|---|---|
| `FIGMA_ACCESS_TOKEN` | https://figma.com/developers/api#access-tokens | Yes |
| `WEBCAKE_JWT` | DevTools → Cookies → `jwt` | Cho image upload |
| `WEBCAKE_SESSION_ID` | DevTools → Cookies → `wsid` | Cho image upload |

## Tools (10)

### `get_design_context` — Tool chính

Fetch ALL-IN-ONE: screenshot + element tree + component mapping + text + images + implementation prompt.

```
Implement design: https://www.figma.com/design/ABC/File?node-id=1-2
```

Output gồm:
- **Screenshot** download local → Claude xem bằng Read tool
- **Element tree** dev-mode style: position, size, gradient CSS, shadow CSS, text-design class, line-height, letter-spacing
- **Component mapping** → `@/components/design/`
- **Images** auto-upload Webcake CDN URLs
- **Implementation prompt** hướng dẫn Claude implement

### `get_figma_node`
Raw JSON node tree.

### `get_figma_screenshot`
Rendered image URL. Auto-retry giảm scale khi timeout.

### `get_figma_styles`
Design tokens (colors, text, effects).

### `get_figma_components`
Liệt kê Figma components.

### `map_figma_to_vue`
Map elements → Vue design system components.

### `list_design_components`
Browse 62 design components, filter theo category.

### `get_figma_images`
Download URLs cho fill images.

### `export_nodes`
Export nodes thành PNG/SVG/PDF. Dùng cho icons, illustrations.

### `upload_images`
Upload URLs → Webcake CDN (`content.pancake.vn`).

## Cách dùng

Paste Figma link vào AI editor:

```
Implement this design: https://www.figma.com/design/ABC/File?node-id=1-2
```

AI sẽ gọi `get_design_context` → xem screenshot → đọc tree → viết Vue code.

## Element Tree Format

```
FRAME "name" WxH @x,y [row gap:16 pad:12,16,12,16 align:CENTER] bg:#fff rounded:8px shadow(0px 2px 4px #0001)
  TEXT "Hello" 100x24 @16,12 text-design-body-medium Inter/14px/500 color:#333 lh:22px
  IMAGE "photo" 200x150 @16,48 img:abc123...
  SVG "icon" 24x24 @180,12 → export_nodes(node_id="1:23")
  [bg-effect] "glow" 500x500 @-100,200 linear-gradient(152deg, #f7f2dc 0%, #ffe996 100%) blur:1000px
  [illustration] "map" 400x300 @0,100 → export_nodes(node_id="2:34")
  INSTANCE "Button" 120x40 @16,200 [Type=Primary Size=md] → <Button>
```

| Prefix | Nghĩa |
|---|---|
| `@x,y` | Vị trí relative từ parent |
| `[row/col ...]` | Auto-layout (flex) |
| `bg:` | Background color/gradient |
| `rounded:` | Border radius |
| `shadow(...)` | CSS box-shadow |
| `border:` | Border |
| `opacity:` | Opacity |
| `text-design-*` | Text CSS class |
| `lh:` | Line height |
| `ls:` | Letter spacing |
| `img:` | Image ref |
| `→ <Component>` | Vue design component match |
| `→ export_nodes(...)` | SVG/illustration cần export |
| `[bg-effect]` | Decorative blur background |
| `[illustration]` | Vector art group |

## Cấu trúc

```
mcp/webcake_figma_mcp/
├── server.js              # Entry point, tool definitions
├── install.sh             # Auto-setup cho mọi editor
├── package.json
├── README.md
└── src/
    ├── utils.js           # hex(), visible(), txt(), json()
    ├── figma/
    │   ├── client.js      # Figma API: fetch, parse, render
    │   ├── simplify.js    # Simplify node tree for JSON output
    │   ├── upload.js      # Upload images → Webcake CDN
    │   └── download.js    # Download screenshot to local file
    ├── design/
    │   ├── components.js  # 62 Vue component definitions
    │   ├── matcher.js     # Figma → Vue component matching rules
    │   └── text.js        # text-design-* class mapping
    └── context/
        ├── describe.js    # Node tree → dev-mode description
        ├── collectors.js  # Collect text + images from tree
        ├── output.js      # Format output sections
        └── prompt.js      # Implementation prompt template
```

## Mở rộng

Thêm component mới vào `src/design/components.js`:
```js
MyComponent: {
  props: { label: S(), size: S(['sm', 'md', 'lg']) },
  slots: ['default'],
  ex: '<MyComponent label="Hello" size="md" />',
},
```

Thêm matching rule vào `src/design/matcher.js`:
```js
R('my.?component|my.?widget', 'MyComponent'),
```
