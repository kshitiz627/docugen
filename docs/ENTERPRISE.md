# Enterprise Deployment Guide

## Simple Setup for Organizations

### What IT Needs to Do (One-time, 10 minutes)

1. **Create OAuth App in Google Cloud**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project called "Company DocuGen"
   - Enable Google Docs API and Google Drive API
   - Create OAuth credentials (Desktop app type)
   - Download credentials.json

2. **Share with Employees**
   
   Send this email to all employees:
   ```
   Subject: DocuGen Setup - Google Docs AI Assistant
   
   1. Install Node.js from https://nodejs.org (if not installed)
   
   2. Copy this configuration to your AI client:
   
   For Claude Desktop:
   Location: ~/Library/Application Support/Claude/claude_desktop_config.json (Mac)
            %APPDATA%\Claude\claude_desktop_config.json (Windows)
   
   {
     "mcpServers": {
       "docugen": {
         "command": "npx",
         "args": ["docugen-mcp"],
         "env": {
           "GOOGLE_CLIENT_ID": "YOUR_COMPANY_ID.apps.googleusercontent.com",
           "GOOGLE_CLIENT_SECRET": "YOUR_COMPANY_SECRET"
         }
       }
     }
   }
   
   3. Restart your AI client
   
   4. First use: Browser will open - sign in with your Google account
   
   Done! You can now create Google Docs with AI.
   ```

### What Each Employee Does (One-time, 2 minutes)

1. Copy the configuration above
2. Paste into their AI client config file
3. Restart the AI client
4. Use DocuGen - browser opens once for Google login
5. That's it!

## How It Works (Simple Explanation)

```
Company OAuth App (shared CLIENT_ID and SECRET)
        ↓
Employee A logs in with their Google → Sees only A's docs
Employee B logs in with their Google → Sees only B's docs
```

- **OAuth App** = Like a company badge printer
- **Login** = Your personal badge with your photo
- **Result** = Everyone uses same printer, but each badge only opens your doors

## Security FAQ

**Q: Can Employee A see Employee B's documents?**  
A: No. Each person logs in with their own Google account and only sees their own documents.

**Q: Is it safe to share CLIENT_ID and SECRET internally?**  
A: Yes. These just identify your company's app. Each employee's login determines what they can access.

**Q: Where are tokens stored?**  
A: On each employee's local computer in their home directory. Never shared.

## For Different AI Clients

### Cursor
File: `~/.cursor/mcp.json` (Mac/Linux) or `C:\Users\[Username]\.cursor\mcp.json` (Windows)

### Windsurf  
File: `~/.codeium/windsurf/mcp_config.json`

### Cline
File: See [SETUP_CLINE.md](./SETUP_CLINE.md) for paths

## Troubleshooting

**"No credentials found"**
- Check that CLIENT_ID and CLIENT_SECRET are copied correctly
- Make sure there are no extra spaces

**Browser doesn't open**
- Try running `npx docugen-mcp` directly in terminal
- Check if default browser is set

**Can't see documents**
- Make sure you logged in with your company Google account
- Check if Google Docs API is enabled in the OAuth app

## That's It!

No service accounts, no complex setup. Just:
1. IT creates one OAuth app
2. Shares the configuration
3. Employees paste it and login once

For detailed technical explanation, see [How Authentication Works](./HOW_AUTH_WORKS.md)