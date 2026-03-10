#!/bin/bash
# deploy-mcp-servers.sh

echo "🚀 Deploying MCP Servers..."

# Set environment variables
export GITHUB_PERSONAL_ACCESS_TOKEN="<set-in-your-shell>"
export SUPABASE_ACCESS_TOKEN="<set-in-your-shell>"
export TAVILY_API_KEY="<set-in-your-shell>"
export PERPLEXITY_API_KEY="<set-in-your-shell>"
export KAGI_API_KEY="<set-in-your-shell>"
export JINA_AI_API_KEY="<set-in-your-shell>"
export BRAVE_API_KEY="<set-in-your-shell>"
export FIRECRAWL_API_KEY="<set-in-your-shell>"

# Start prerequisite services
echo "🔴 Starting Redis..."
redis-server --port 6379 --daemonize yes

# Deploy all MCP servers
echo "🛠️  Deploying MCP servers..."
npx -y @modelcontextprotocol/server-redis redis://localhost:6379 &
python3 -m mcp_server_git &
npx -y @modelcontextprotocol/server-puppeteer &
npx -y @modelcontextprotocol/server-sequential-thinking &
npx -y @modelcontextprotocol/server-filesystem /Users/chrisdukes/Desktop &
npx -y @modelcontextprotocol/server-github &
npx -y @modelcontextprotocol/server-memory &
npx -y @supabase/mcp-server-supabase@latest --access-token=$SUPABASE_ACCESS_TOKEN &
npx -y mcp-omnisearch &

echo "✅ All MCP servers deployed!"
echo "🔧 Servers running in background processes"
echo "📋 Check server status with: ps aux | grep mcp"
