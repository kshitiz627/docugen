# Setting Up DocuGen in Claude Desktop

This guide shows you how to configure DocuGen MCP server in Claude Desktop.

## Prerequisites

✅ You have [created Google OAuth credentials](./SETUP_OAUTH.md)  
✅ You have Claude Desktop installed  
✅ You know where your `credentials.json` file is located

## Configuration Steps

### Step 1: Locate Configuration File

The configuration file location depends on your operating system:

#### macOS
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

To open it:
1. Open Finder
2. Press `Cmd + Shift + G`
3. Paste: `~/Library/Application Support/Claude/`
4. Look for `claude_desktop_config.json`

#### Windows
```
%APPDATA%\Claude\claude_desktop_config.json
```

To open it:
1. Press `Win + R`
2. Type: `%APPDATA%\Claude\`
3. Press Enter
4. Look for `claude_desktop_config.json`

### Step 2: Edit Configuration

Open `claude_desktop_config.json` in a text editor and add the DocuGen configuration:

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

**Important**: Replace `/path/to/your/credentials.json` with your actual path:
- Mac: `/Users/YourName/docugen/credentials.json`
- Windows: `C:\\Users\\YourName\\docugen\\credentials.json` (note the double backslashes)

#### For Organization Users (Shared OAuth)

If your IT department provided CLIENT_ID and CLIENT_SECRET:

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

### Step 3: Save and Restart Claude

1. Save the configuration file
2. **Completely quit Claude Desktop**:
   - Mac: Cmd + Q or Claude → Quit Claude
   - Windows: Right-click system tray icon → Exit
3. Start Claude Desktop again

### Step 4: Verify Installation

In Claude, type:
```
Can you list my Google Docs?
```

On first use:
1. A browser window will open
2. Sign in with your Google account
3. Click "Allow" to grant permissions
4. Return to Claude

## Troubleshooting

### "MCP server not found" error

1. Check your JSON syntax - make sure all brackets and commas are correct
2. Ensure you completely quit and restarted Claude
3. Verify the path to credentials.json is correct

### "No credentials found" error

1. Check that your credentials.json file exists at the specified path
2. Make sure you're using forward slashes (/) on Mac or double backslashes (\\\\) on Windows

### Claude doesn't respond to document commands

1. Check if DocuGen appears in Claude's MCP servers (it should show when you start typing document-related commands)
2. Try the command: "Create a test Google Doc"
3. Check the logs at:
   - Mac: `~/Library/Logs/Claude/mcp.log`
   - Windows: `%APPDATA%\Claude\logs\mcp.log`

## Testing DocuGen

Try these commands to test if everything is working:

```
"Create a new Google Doc called 'Test Document'"
"List my recent Google Docs"
"Create a PRD for a new feature"
```

## Next Steps

- Learn about [available templates](../templates/README.md)
- See [usage examples](../README.md#how-to-use)
- Check out [troubleshooting guide](./TROUBLESHOOTING.md)

## Need Help?

- [GitHub Discussions](https://github.com/eagleisbatman/docugen/discussions)
- [Report an Issue](https://github.com/eagleisbatman/docugen/issues)