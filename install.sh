#!/bin/bash
set -e

REPO_URL="https://github.com/pancake-vn/builderx_spa.git"
MCP_SUBDIR="mcp/figma-vue"

# Detect if running from repo or via curl | bash
if [ -f "$(dirname "$0")/server.js" ] 2>/dev/null; then
  DIR="$(cd "$(dirname "$0")" && pwd)"
  ROOT="$(cd "$DIR/../.." && pwd)"
else
  # Running via curl | bash — clone MCP into current project
  echo "=== Downloading Figma-Vue MCP ==="
  ROOT="$(pwd)"
  DIR="$ROOT/$MCP_SUBDIR"

  if [ -d "$DIR" ]; then
    echo "  → $MCP_SUBDIR already exists, updating..."
    cd "$DIR" && git pull --quiet 2>/dev/null || true
  else
    echo "  → Cloning $MCP_SUBDIR..."
    mkdir -p "$ROOT/mcp"
    git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" /tmp/figma-vue-clone 2>/dev/null
    cd /tmp/figma-vue-clone && git sparse-checkout set "$MCP_SUBDIR" 2>/dev/null
    cp -r "/tmp/figma-vue-clone/$MCP_SUBDIR" "$DIR"
    rm -rf /tmp/figma-vue-clone
  fi
  echo "  ✓ Downloaded to $DIR"
fi

SERVER_PATH="$DIR/server.js"

echo ""
echo "=== Figma-Vue MCP Setup ==="
echo ""

# 1. Install dependencies
echo "→ Installing dependencies..."
cd "$DIR"
npm install --silent
echo "  ✓ Done"
echo ""

# 2. Collect tokens
echo "→ Token configuration"
echo "  (Leave blank to skip, fill later in config file)"
echo ""
read -p "  Figma Access Token (https://figma.com/developers/api#access-tokens): " FIGMA_TOKEN
read -p "  Webcake JWT (cookie 'jwt'): " WEBCAKE_TOKEN
read -p "  Webcake Session ID (cookie 'wsid'): " WEBCAKE_SESSION
echo ""

# 3. Select editors
echo "→ Select editors to configure (space to toggle, enter to confirm):"
echo ""

EDITORS=()
for editor in "Claude Code" "Cursor" "VS Code (Copilot)" "Windsurf" "Antigravity" "Codex CLI"; do
  read -p "  Install for $editor? [y/N]: " yn
  case $yn in [yY]*) EDITORS+=("$editor");; esac
done
echo ""

# Helper: build MCP JSON block
mcp_json_stdio() {
  cat << EOF
{
  "type": "stdio",
  "command": "node",
  "args": ["$SERVER_PATH"],
  "env": {
    "FIGMA_ACCESS_TOKEN": "${FIGMA_TOKEN}",
    "WEBCAKE_JWT": "${WEBCAKE_TOKEN}",
    "WEBCAKE_SESSION_ID": "${WEBCAKE_SESSION}"
  }
}
EOF
}

mcp_json_full() {
  cat << EOF
{
  "mcpServers": {
    "figma-vue": $(mcp_json_stdio)
  }
}
EOF
}

# Helper: merge into existing JSON or create new
upsert_mcp_config() {
  local file="$1"
  local dir="$(dirname "$file")"
  mkdir -p "$dir"

  if [ -f "$file" ]; then
    # Check if figma-vue already configured
    if grep -q "figma-vue" "$file" 2>/dev/null; then
      echo "  ✓ $file (already configured)"
      return
    fi
    # Merge into existing mcpServers
    python3 -c "
import json, sys
with open('$file', 'r') as f: cfg = json.load(f)
cfg.setdefault('mcpServers', {})
cfg['mcpServers']['figma-vue'] = $(mcp_json_stdio | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)))")
with open('$file', 'w') as f: json.dump(cfg, f, indent=2)
" 2>/dev/null && echo "  ✓ $file (updated)" && return
  fi

  # Create new file
  echo "$(mcp_json_full)" | python3 -c "import sys,json; json.dump(json.load(sys.stdin), open('$file','w'), indent=2)"
  echo "  ✓ $file (created)"
}

# 4. Configure each editor
echo "→ Configuring editors..."

for editor in "${EDITORS[@]}"; do
  case "$editor" in

    "Claude Code")
      # Project-level .mcp.json
      upsert_mcp_config "$ROOT/.mcp.json"
      ;;

    "Cursor")
      # Project: .cursor/mcp.json
      upsert_mcp_config "$ROOT/.cursor/mcp.json"
      ;;

    "VS Code (Copilot)")
      # Project: .vscode/mcp.json (VS Code format uses "servers" key)
      VSCODE_FILE="$ROOT/.vscode/mcp.json"
      mkdir -p "$ROOT/.vscode"
      if [ -f "$VSCODE_FILE" ] && grep -q "figma-vue" "$VSCODE_FILE" 2>/dev/null; then
        echo "  ✓ $VSCODE_FILE (already configured)"
      else
        python3 -c "
import json
cfg = {}
try:
  with open('$VSCODE_FILE', 'r') as f: cfg = json.load(f)
except: pass
cfg.setdefault('servers', {})
cfg['servers']['figma-vue'] = {
  'type': 'stdio',
  'command': 'node',
  'args': ['$SERVER_PATH'],
  'env': {
    'FIGMA_ACCESS_TOKEN': '${FIGMA_TOKEN}',
    'WEBCAKE_JWT': '${WEBCAKE_TOKEN}',
    'WEBCAKE_SESSION_ID': '${WEBCAKE_SESSION}'
  }
}
with open('$VSCODE_FILE', 'w') as f: json.dump(cfg, f, indent=2)
print('  ✓ $VSCODE_FILE')
"
      fi
      ;;

    "Windsurf")
      # Global: ~/.codeium/windsurf/mcp_config.json
      WINDSURF_FILE="$HOME/.codeium/windsurf/mcp_config.json"
      upsert_mcp_config "$WINDSURF_FILE"
      ;;

    "Antigravity")
      # Global: ~/.gemini/antigravity/mcp_config.json
      upsert_mcp_config "$HOME/.gemini/antigravity/mcp_config.json"
      ;;

    "Codex CLI")
      # Project: .codex/mcp.json
      upsert_mcp_config "$ROOT/.codex/mcp.json"
      ;;

  esac
done

# 5. Verify server
echo ""
echo "→ Verifying server..."
TOOLS=$(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
  | FIGMA_ACCESS_TOKEN="${FIGMA_TOKEN:-test}" node "$SERVER_PATH" 2>/dev/null | tail -1 \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d['result']['tools']))" 2>/dev/null)

if [ "$TOOLS" -gt 0 ] 2>/dev/null; then
  echo "  ✓ Server OK — $TOOLS tools"
else
  echo "  ✗ Server check failed"
fi

# 6. Summary
echo ""
echo "=== Setup Complete ==="
echo ""
echo "Configured for: ${EDITORS[*]:-none}"
echo ""
if [ -z "$FIGMA_TOKEN" ] || [ -z "$WEBCAKE_TOKEN" ]; then
  echo "⚠ Missing tokens — fill them in the config files above"
  echo ""
fi
echo "Restart your editor to load the MCP server."
