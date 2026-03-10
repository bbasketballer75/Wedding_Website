# deploy-mcp-servers.ps1

Write-Host "🚀 Deploying MCP Servers..."

# Populate API keys from your environment before running this script.
# Example:
# $env:GITHUB_PERSONAL_ACCESS_TOKEN = "<set-in-your-shell>"
# $env:SUPABASE_ACCESS_TOKEN = "<set-in-your-shell>"
# $env:TAVILY_API_KEY = "<set-in-your-shell>"
# $env:PERPLEXITY_API_KEY = "<set-in-your-shell>"
# $env:KAGI_API_KEY = "<set-in-your-shell>"
# $env:JINA_AI_API_KEY = "<set-in-your-shell>"
# $env:BRAVE_API_KEY = "<set-in-your-shell>"
# $env:FIRECRAWL_API_KEY = "<set-in-your-shell>"

# INFO: Starting Redis for Windows. The '--daemonize' flag is not supported and has been removed.
# This requires Redis to be in your PATH.
Write-Host "🔴 Starting Redis..."
Start-Process redis-server -ArgumentList "--port 6379"

# Deploy all MCP servers as background jobs.
Write-Host "🛠️  Deploying MCP servers..."
Start-Job -ScriptBlock { npx -y @modelcontextprotocol/server-redis redis://localhost:6379 }
Start-Job -ScriptBlock { python -m mcp_server_git }
Start-Job -ScriptBlock { npx -y @modelcontextprotocol/server-puppeteer }
Start-Job -ScriptBlock { npx -y @modelcontextprotocol/server-sequential-thinking }
Start-Job -ScriptBlock { npx -y @modelcontextprotocol/server-filesystem C:\Users\bbask\Coding_Projects\Wedding_Website }
Start-Job -ScriptBlock { npx -y @modelcontextprotocol/server-github }
Start-Job -ScriptBlock { npx -y @modelcontextprotocol/server-memory }
Start-Job -ScriptBlock { npx -y @supabase/mcp-server-supabase@latest --access-token=$env:SUPABASE_ACCESS_TOKEN }
Start-Job -ScriptBlock { npx -y mcp-omnisearch }

Write-Host "✅ All MCP servers deployed as background jobs!"
Write-Host "🔧 To view running jobs, use the 'Get-Job' command."
Write-Host "💡 To see output from a specific job, use 'Receive-Job -Id <JobId>'."
