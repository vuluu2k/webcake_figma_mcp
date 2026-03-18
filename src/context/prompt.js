export const IMPLEMENTATION_PROMPT = (layoutType) => `## Implementation Prompt

You MUST implement this Figma design as a Vue 3 SFC that is visually identical to the screenshot above.

### Step 1: Analyze the screenshot
- Open/view the screenshot URL to understand the full visual layout
- Identify the visual hierarchy: background, foreground, overlapping layers
- Layout type: ${layoutType}

### Step 2: Build the layout
- Tailwind CSS utility classes ONLY (no inline styles, no <style> block)
- Auto-layout frames → \`flex\` / \`flex-col\` / \`gap-N\` / \`p-N\` / \`items-center\` / \`justify-between\`
- Overlapping elements → \`relative\` on parent, \`absolute top-N left-N\` on children
- Match exact dimensions (WxH) → \`w-[Npx]\` \`h-[Npx]\` for non-standard sizes
- Spacing px→Tailwind: 4=1, 8=2, 12=3, 16=4, 20=5, 24=6, 32=8

### Step 3: Visual styles
- Colors: exact hex → \`bg-[#hex]\` \`text-[#hex]\`
- Radius: \`rounded-[Npx]\`
- Shadows: \`shadow-sm\` / \`shadow\` / \`shadow-md\` / \`shadow-lg\`
- Borders: \`border border-[#hex]\`
- Opacity: \`opacity-N\`
- Overflow: \`overflow-hidden\` when "clip"

### Step 4: Design system components
- ALWAYS use \`@/components/design/\` when a match exists (see Component Mapping above)
- Use exact props, slots, examples shown
- Import all used components in \`<script setup>\`

### Step 5: Text
- Use \`text-design-{level}-{weight}\` CSS classes (NOT <Typography> component)
- Each TEXT node shows its exact class (e.g. \`text-design-h3-semibold\`)
- Size→level: ≥48→h0, ≥38→h1, ≥30→h2, ≥24→h3, ≥20→h4, ≥16→h5, ≥14→body, ≥13→body-sm, ≥12→footnote, <12→footnote-sm
- Weight: 300→light, 400→regular, 500→medium, 600→semibold, 700→bold
- Example: \`<span class="text-design-h3-semibold">Title</span>\`
- Use EXACT text content — do NOT change or translate
- Text color: \`<span class="text-design-body-medium text-[#hex]">text</span>\`

### Step 6: Images
- Image assets with download URLs are in the Image Assets section
- Use \`<img :src="url" />\` or \`<Image>\` component with exact width/height
- Decorative/background images → CSS background or absolute-positioned img
- [decorative] (skip) elements → recreate with CSS gradients/blur or skip

### Step 7: Final check
- Compare against screenshot for visual parity
- Verify: colors, spacing, text content, image sizes, component usage
- No placeholder text, no dummy images, no missing elements

### Tech Stack
- Vue 3 + Composition API (\`<script setup>\`)
- Tailwind CSS (arbitrary values with \`[]\`)
- Components: \`@/components/design/\`
- Icons: \`@phosphor-icons/vue\` (e.g. \`<PhPencil />\`)
- NO \`<style>\` block
- Single quotes, no semicolons, 2-space indent
`
