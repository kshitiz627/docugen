# Setting Up DocuGen in Windsurf

This guide shows you how to configure DocuGen MCP server in Windsurf Editor.

## Prerequisites

✅ You have [created Google OAuth credentials](./SETUP_OAUTH.md)  
✅ You have Windsurf installed  
✅ You know where your `credentials.json` file is located

## Configuration Steps

### Step 1: Open Windsurf Configuration

Windsurf only supports global configuration (not project-specific).

#### Method 1: Through Cascade UI

1. Open Windsurf
2. Open Cascade (AI assistant)
3. Click the **hammer icon** (🔨) for MCP settings
4. Click **"Configure"**

#### Method 2: Direct File Access

Navigate to the configuration file:

**macOS/Linux:**
```
~/.codeium/windsurf/mcp_config.json
```

**Windows:**
```
C:\Users\YourUsername\.codeium\windsurf\mcp_config.json
```

### Step 2: Add DocuGen Configuration

Edit `mcp_config.json` and add:

#### For Individual Users (Personal OAuth)

```json
{
  "mcpServers": {
    "docugen": {
      "command": "npx",
      "args": ["docugen-mcp"],
      "env": {
        "GOOGLE_OAUTH_PATH": "/path/to/your/credentials.json"
      }
    }
  }
}
```

**Important**: Replace `/path/to/your/credentials.json` with your actual path.

#### For Organization Users (Shared OAuth)

```json
{
  "mcpServers": {
    "docugen": {
      "command": "npx",
      "args": ["docugen-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-company-app.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "your-company-secret"
      }
    }
  }
}
```

### Step 3: Save and Restart

1. Save the configuration file
2. Completely restart Windsurf
3. The MCP server will start automatically

## Verification

### Check MCP Status

1. Open Cascade assistant
2. Look for the MCP icon in the interface
3. DocuGen should appear in the available tools

### Test Commands

In Cascade, try:

```
Create a new Google Doc called "Windsurf Test"
```

On first use:
1. Browser opens for authentication
2. Sign in with Google
3. Authorize DocuGen
4. Return to Windsurf

## Using DocuGen in Windsurf

### With Cascade Assistant

Ask Cascade to:
- "Create a product requirements document"
- "List my recent Google Docs"
- "Generate a test plan for this code"

### Integrated with Code

When reviewing code, you can:
- "Document this API in a Google Doc"
- "Create a technical spec for this module"
- "Generate release notes from recent changes"

## Windsurf-Specific Notes

### Configuration Differences

⚠️ **Important**: Windsurf configuration has some differences:

1. **No project-specific config** - Only global configuration is supported
2. **File location** - Uses `.codeium` directory, not `.windsurf`
3. **Auto-reload** - Changes may require full restart

### Known Issues

1. **First-time setup**: The MCP server might take a minute to download on first run
2. **Path format**: Always use forward slashes (`/`) even on Windows
3. **Environment variables**: Must be in the `env` object, not system environment

## Troubleshooting

### MCP server not starting

1. Check JSON syntax - Windsurf is strict about formatting
2. Verify npx is available in your PATH
3. Check Windsurf's output panel for errors

### "Command not found: npx"

Install Node.js and npm:
```bash
# Check if installed
node --version
npm --version

# If not installed, download from nodejs.org
```

### Authentication loop

1. Clear any existing tokens:
   ```bash
   rm ~/.docugen/token.json
   ```
2. Restart Windsurf
3. Try authentication again

### DocuGen not appearing in Cascade

1. Check the hammer icon (🔨) → should list DocuGen
2. Verify configuration file exists and is valid JSON
3. Look for errors in Windsurf's console

## Best Practices for Windsurf

1. **Use absolute paths** for credentials file
2. **Test after setup** with simple commands first
3. **Keep Windsurf updated** for best MCP support
4. **Check logs** if issues occur

## Advanced Configuration

### Multiple MCP Servers

```json
{
  "mcpServers": {
    "docugen": {
      "command": "npx",
      "args": ["docugen-mcp"],
      "env": {
        "GOOGLE_OAUTH_PATH": "/path/to/credentials.json"
      }
    },
    "other-server": {
      "command": "npx",
      "args": ["other-mcp-server"]
    }
  }
}
```

### Custom Token Storage

```json
{
  "mcpServers": {
    "docugen": {
      "command": "npx",
      "args": ["docugen-mcp"],
      "env": {
        "GOOGLE_OAUTH_PATH": "/path/to/credentials.json",
        "TOKEN_PATH": "/custom/path/to/token.json"
      }
    }
  }
}
```

## Next Steps

- Learn about [templates](../templates/README.md)
- Explore [usage examples](../README.md#how-to-use)
- Check [troubleshooting guide](./TROUBLESHOOTING.md)

## Need Help?

- [GitHub Discussions](https://github.com/eagleisbatman/docugen/discussions)
- [Windsurf Documentation](https://docs.windsurf.com)