# Setting Up DocuGen in Cursor

This guide shows you how to configure DocuGen MCP server in Cursor IDE.

## Prerequisites

✅ You have [created Google OAuth credentials](./SETUP_OAUTH.md)  
✅ You have Cursor installed  
✅ You know where your `credentials.json` file is located

## Configuration Options

Cursor supports two configuration levels:

1. **Project-specific** - Only for current project
2. **Global** - Available in all projects

## Project-Specific Configuration

### Step 1: Create Configuration File

In your project root, create the folder and file:

```bash
# In your project directory
mkdir .cursor
touch .cursor/mcp.json
```

### Step 2: Add Configuration

Open `.cursor/mcp.json` and add:

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

## Global Configuration

### Step 1: Create Global Config File

The global configuration file location:

#### macOS/Linux
```bash
touch ~/.cursor/mcp.json
```

#### Windows
Create file at: `C:\Users\YourUsername\.cursor\mcp.json`

### Step 2: Add Configuration

Use the same JSON configuration as shown above.

### Step 3: Restart Cursor

1. Save the configuration file
2. Restart Cursor (Cmd/Ctrl + Q, then reopen)

## Alternative: Using Cursor Settings UI

1. Open Cursor Settings:
   - Mac: `Cmd + ,`
   - Windows/Linux: `Ctrl + ,`

2. Navigate to the **MCP** tab

3. Click **"+ Add new global MCP server"**

4. Fill in:
   - **Name**: `docugen`
   - **Command**: `npx`
   - **Arguments**: `docugen-mcp`
   - **Environment Variables**: Add your OAuth configuration

5. Save and restart Cursor

## Verification

In Cursor's AI chat, try:

```
Create a new Google Doc called "Test from Cursor"
```

On first use:
1. A browser window will open for Google authentication
2. Sign in and authorize
3. Return to Cursor

## Using DocuGen in Cursor

### With Cursor Chat

Open the chat panel and try:
- "Create a PRD for our new feature"
- "List my recent Google Docs"
- "Generate a technical specification"

### With Cursor Composer

When using Composer for larger tasks:
- "Create a complete test plan document for this codebase"
- "Generate release notes based on recent commits"

## Troubleshooting

### MCP server not connecting

1. Check JSON syntax in your mcp.json file
2. Ensure file paths use forward slashes (even on Windows)
3. Restart Cursor completely

### Authentication issues

1. Delete any existing token.json file
2. Ensure credentials.json exists at the specified path
3. Try authenticating again

### Server not available in chat

1. Check if the MCP icon appears in Cursor's chat interface
2. Verify the configuration file is in the correct location
3. Check Cursor's output panel for error messages

## Project vs Global Configuration

**Use Project-specific when:**
- Working on a specific project that needs DocuGen
- Team members share the same project
- You want to commit the configuration to git (without credentials)

**Use Global when:**
- You want DocuGen available in all projects
- Personal development setup
- You frequently create documents across different projects

## Best Practices

1. **For Teams**: Use project-specific config with environment variables
2. **For Personal Use**: Use global config for convenience
3. **Security**: Never commit credentials.json to version control
4. **Paths**: Always use absolute paths for credentials file

## Next Steps

- Explore [available templates](../templates/README.md)
- Learn [advanced usage](../README.md#how-to-use)
- Set up in [other IDEs](./README.md)

## Need Help?

- [GitHub Discussions](https://github.com/eagleisbatman/docugen/discussions)
- [Cursor Forums](https://forum.cursor.sh/)