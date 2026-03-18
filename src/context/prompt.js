export const IMPLEMENTATION_PROMPT = (layoutType) => `## Implementation Prompt

You MUST implement this Figma design as a Vue 3 SFC that is **visually identical** to the screenshot above.

### Step 1: VIEW the screenshot (CRITICAL)
- Use the Read tool to open the local screenshot file path shown above — you MUST see the design before writing ANY code
- Study the visual layout: what is background, what overlaps, spacing, colors, typography
- This is the source of truth — your code must match this image exactly
- Layout type detected: **${layoutType}**

### Step 2: Build the layout
- Tailwind CSS utility classes ONLY (no inline styles, no \`<style>\` block unless absolutely needed for gradients/animations)
- **Auto-layout frames** (marked \`[row]\`/\`[col]\`): use \`flex\` / \`flex-col\` / \`gap-N\` / \`p-N\` / \`items-center\` / \`justify-between\`
- **Overlapping/absolute elements** (no \`[row]\`/\`[col]\`): use \`relative\` on parent, \`absolute\` on children
  - Use the exact \`at(x, y)\` coordinates from the Element Tree
  - Convert to Tailwind: \`at(100, 200)\` → \`absolute left-[100px] top-[200px]\`
  - Root container: \`relative w-[Wpx] h-[Hpx] overflow-hidden\`
- Match exact dimensions (WxH) → \`w-[Npx]\` \`h-[Npx]\`
- Spacing px→Tailwind: 4=1, 8=2, 12=3, 16=4, 20=5, 24=6, 32=8

### Step 3: Visual styles
- Colors: exact hex → \`bg-[#hex]\` \`text-[#hex]\`
- Radius: \`rounded-[Npx]\`
- Shadows: \`shadow-sm\` / \`shadow\` / \`shadow-md\` / \`shadow-lg\`
- Borders: \`border border-[#hex]\`
- Opacity: \`opacity-N\`
- Do NOT add \`overflow-hidden\` unless explicitly needed — it causes images to be cropped

### Step 4: Background effects (decorative elements)
Elements marked \`[bg-effect]\` are decorative backgrounds. Recreate them with CSS:
- **Blurred ellipses**: \`<div class="absolute left-[Xpx] top-[Ypx] w-[Wpx] h-[Hpx] rounded-full blur-[Npx]" style="background: linear-gradient(...)"></div>\`
- Use the gradient colors and blur radius shown in the tree
- These create the ambient glow/background effect — they are important for visual fidelity
- Layer them behind content using element order or \`z-0\`/\`z-10\`

Elements marked \`[illustration]\` are complex vector art. Use \`export_nodes\` tool to render them as PNG/SVG, then use as \`<img>\`.

### Step 5: Design system components
- ALWAYS use \`@/components/design/\` when a match exists (see Component Mapping above)
- Use exact props, slots, examples shown
- Import all used components in \`<script setup>\`

### Step 6: Text
- Use \`text-design-{level}-{weight}\` CSS classes (NOT <Typography> component)
- Each TEXT node shows its exact class (e.g. \`text-design-h3-semibold\`)
- Size→level: ≥48→h0, ≥38→h1, ≥30→h2, ≥24→h3, ≥20→h4, ≥16→h5, ≥14→body, ≥13→body-sm, ≥12→footnote, <12→footnote-sm
- Weight: 300→light, 400→regular, 500→medium, 600→semibold, 700→bold
- Example: \`<span class="text-design-h3-semibold">Title</span>\`
- Use EXACT text content — do NOT change or translate
- Text color: \`<span class="text-design-body-medium text-[#hex]">text</span>\`

### Step 7: Images
- Image assets with \`src:\` URLs (Webcake CDN) are permanent — use them directly in code
- Images with \`url:\` (Figma S3) are temporary — call \`upload_images\` tool to convert first
- Use \`<img :src="url" class="w-[Wpx] h-[Hpx]" />\` with exact dimensions — do NOT use object-cover (crops images)
- Position images using \`absolute left-[Xpx] top-[Ypx]\` from the \`at(x,y)\` coordinates

### Step 8: Final check
- Compare against screenshot for pixel-level visual parity
- Verify: all elements positioned correctly, correct colors, correct text, correct images
- Verify: background effects recreated (blurred gradients)
- Verify: no placeholder text, no dummy images, no missing elements
- Verify: z-ordering matches the design (background → decoration → content → foreground)

### Tech Stack
- Vue 3 + Composition API (\`<script setup>\`)
- Tailwind CSS (arbitrary values with \`[]\`)
- Components: \`@/components/design/\`
- Icons: \`@phosphor-icons/vue\` (e.g. \`<PhPencil />\`)
- \`<style>\` block only if needed for CSS gradients that can't be done with Tailwind
- Single quotes, no semicolons, 2-space indent
`
