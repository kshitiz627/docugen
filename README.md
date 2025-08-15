# DocuGen MCP Server

Create Google Docs with AI using templates and native formatting.

## What is DocuGen?

DocuGen is an MCP (Model Context Protocol) server that lets AI assistants like Claude, Cursor, and Windsurf create professional Google Docs. Instead of markdown exports, you get real Google Docs with native formatting, tables, and templates.

## Installation

```bash
# No installation needed - runs with npx
npx docugen-mcp --version
```

## Setup Guide

### Step 1: Create Google OAuth Credentials (5 minutes)

1. Go to https://console.cloud.google.com
2. Sign in with your Google account
3. Click "Select a project" → "NEW PROJECT"
4. Name it "DocuGen" and click "CREATE"
5. Wait 10 seconds, then select your new project from the dropdown

#### Enable APIs:
1. Click hamburger menu (☰) → "APIs & Services" → "Library"
2. Search "Google Docs API" → Click it → Click "ENABLE"
3. Go back, search "Google Drive API" → Click it → Click "ENABLE"

#### Configure OAuth:
1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" (or "Internal" for Google Workspace)
3. Fill in:
   - App name: `DocuGen MCP`
   - User support email: Your email
   - Developer contact: Your email
4. Click "SAVE AND CONTINUE" through all steps

#### Create Credentials:
1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Choose "Desktop app"
4. Name it "DocuGen Desktop"
5. Click "CREATE"
6. Click "DOWNLOAD JSON"
7. Save as `credentials.json` in your home directory

### Step 2: Configure Your AI Client

#### For Claude Desktop

**Mac:** Edit `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows:** Edit `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "docugen": {
      "command": "npx",
      "args": ["docugen-mcp"],
      "env": {
        "GOOGLE_OAUTH_PATH": "/path/to/credentials.json"
      }
    }
  }
}
```

#### For Cursor

Create `.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally:

```json
{
  "mcpServers": {
    "docugen": {
      "command": "npx",
      "args": ["docugen-mcp"],
      "env": {
        "GOOGLE_OAUTH_PATH": "/path/to/credentials.json"
      }
    }
  }
}
```

#### For Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "docugen": {
      "command": "npx",
      "args": ["docugen-mcp"],
      "env": {
        "GOOGLE_OAUTH_PATH": "/path/to/credentials.json"
      }
    }
  }
}
```

#### For Cline

**Mac:** Edit `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`  
**Windows:** Edit `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`

Use the same JSON configuration as above.

### Step 3: Start Using DocuGen

1. Restart your AI client completely
2. Ask your AI: "Create a new Google Doc called Test"
3. On first use, a browser will open - sign in with Google
4. That's it! You're ready to create documents

## Usage Examples

```
"Create a new Google Doc called Meeting Notes"
"Make a product requirements document for our search feature"
"Generate a technical specification with sections for API design"
"Create a test plan document"
"List my recent Google Docs"
"Search for documents about roadmap"
```

## Available Templates

DocuGen includes professional templates:
- Product Requirements Document (PRD)
- Technical Specification
- Test Plan
- Release Notes
- Business Case

Use them like: "Create a PRD for our new feature"

## For Organizations

If your IT team wants to deploy DocuGen for many users:

### IT Setup (10 minutes):
1. Create ONE OAuth app following Step 1 above
2. Share these with employees:
   - CLIENT_ID from the OAuth app
   - CLIENT_SECRET from the OAuth app

### Employee Setup (2 minutes):
Instead of `GOOGLE_OAUTH_PATH`, use:
```json
{
  "mcpServers": {
    "docugen": {
      "command": "npx",
      "args": ["docugen-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "company-app.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "company-secret"
      }
    }
  }
}
```

Each employee still logs in with their own Google account and sees only their documents.

## How Authentication Works

**Question:** If everyone uses the same OAuth app, how does each person only see their own docs?

**Answer:** The OAuth app is just the "identity" of DocuGen. When each person logs in through their browser, they get their own personal access token that's stored on their computer. This token determines which documents they can access.

Think of it like a building keycard system:
- OAuth app = The keycard printer (same for everyone)
- Your login = Getting your personal keycard with your photo
- Result = Same printer, but each card only opens your office

## Troubleshooting

### "No credentials found"
- Make sure credentials.json exists at the path you specified
- Check for typos in the path

### "APIs not enabled"
- Go back to Google Cloud Console
- Make sure both Google Docs API and Drive API show "Enabled"

### MCP server not showing in AI client
- Completely quit and restart your AI client
- Check your JSON configuration for syntax errors
- Make sure you're using forward slashes (/) in paths, even on Windows

### Browser doesn't open for authentication
- Try running `npx docugen-mcp` directly in terminal
- Make sure you have a default browser set

### "Token has been expired or revoked"
- Delete `~/.docugen/token.json`
- Restart your AI client to re-authenticate

## Features

- ✅ Native Google Docs formatting (not markdown)
- ✅ Professional templates built-in
- ✅ Works with all major AI coding assistants
- ✅ Create, update, list, and search documents
- ✅ Tables, lists, headings with proper formatting
- ✅ Each user only accesses their own documents

## Requirements

- Node.js 16+ installed
- Google account
- Any MCP-compatible AI client (Claude, Cursor, Windsurf, Cline, etc.)

## License

Apache 2.0 - Free for personal and commercial use

## Author

Created by Gautam Mandewalker

---

**Need help?** Open an issue at https://github.com/eagleisbatman/docugen/issues