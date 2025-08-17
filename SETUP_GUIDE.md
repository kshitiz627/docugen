# DocuGen MCP Server - Setup Guide

## Step 1: Google OAuth Setup

### 1.1 Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

### 1.2 Enable Google Sheets API
1. In your project, go to "APIs & Services" > "Library"
2. Search for "Google Sheets API"
3. Click on it and press "Enable"

### 1.3 Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in required fields (app name, email)
   - Add your email to test users
   - Add scope: `https://www.googleapis.com/auth/spreadsheets`
4. For Application type, choose "Desktop app"
5. Name it "DocuGen MCP"
6. Click "Create"
7. Download the JSON file
8. Save it as `/Users/eagleisbatman/Desktop/credentials.json`

## Step 2: Authenticate

Run the authentication script to generate a token:

```bash
cd /Users/eagleisbatman/digitalgreen_projects/docugen
source venv/bin/activate
GOOGLE_OAUTH_PATH="/Users/eagleisbatman/Desktop/credentials.json" python3.12 authenticate.py
```

This will:
1. Open a browser for Google sign-in
2. Ask for permission to access Google Sheets
3. Create a token at `~/.docugen/sheets_token.json`

## Step 3: Test the Server

Test the server works correctly:

```bash
GOOGLE_OAUTH_PATH="/Users/eagleisbatman/Desktop/credentials.json" python3.12 docugen_mcp_server.py --help
```

You should see the list of available tools.

## Step 4: Configure Claude Desktop

1. Open Claude Desktop settings
2. Go to Developer > Edit Config
3. Replace the content with:

```json
{
  "mcpServers": {
    "docugen": {
      "command": "python3.12",
      "args": [
        "/Users/eagleisbatman/digitalgreen_projects/docugen/docugen_mcp_server.py"
      ],
      "env": {
        "GOOGLE_OAUTH_PATH": "/Users/eagleisbatman/Desktop/credentials.json"
      }
    }
  }
}
```

4. Save and restart Claude Desktop

## Step 5: Verify in Claude Desktop

1. Open Claude Desktop
2. Look for the MCP icon (🔌) in the chat interface
3. Click it to see "docugen" listed
4. Test with: "Create a simple budget tracker spreadsheet"

## Troubleshooting

### Server doesn't start
- Check Python version: `python3.12 --version`
- Verify credentials file exists: `ls -la /Users/eagleisbatman/Desktop/credentials.json`
- Check token exists: `ls -la ~/.docugen/sheets_token.json`

### Authentication fails
- Ensure you're logged into the correct Google account
- Check that Google Sheets API is enabled in your project
- Verify the OAuth consent screen is configured

### Claude Desktop doesn't show the server
- Restart Claude Desktop completely
- Check the config file is valid JSON
- Look at logs: `~/Library/Logs/Claude/`

## Quick Test Commands

```bash
# Test server can start
GOOGLE_OAUTH_PATH="/Users/eagleisbatman/Desktop/credentials.json" timeout 2 python3.12 docugen_mcp_server.py

# List available tools
GOOGLE_OAUTH_PATH="/Users/eagleisbatman/Desktop/credentials.json" python3.12 docugen_mcp_server.py --help

# Run test script
GOOGLE_OAUTH_PATH="/Users/eagleisbatman/Desktop/credentials.json" python3.12 test_server.py
```

## Next Steps

Once configured, you can ask Claude to:
- Create budget trackers
- Build financial dashboards
- Import and analyze CSV data
- Generate reports with charts
- Create project management sheets
- Build inventory systems

Just describe what you need in natural language!