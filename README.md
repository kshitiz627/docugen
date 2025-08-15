# DocuGen 📄

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)
[![Google APIs](https://img.shields.io/badge/Google%20APIs-Docs%20%26%20Drive-4285F4)](https://developers.google.com/docs/api)

**Create beautiful Google Docs with AI-powered templates and native formatting through the Model Context Protocol.**

DocuGen is an MCP server that empowers AI assistants to create professional Google Docs with rich formatting, templates, and automation. Works with Claude Desktop, Cursor, Windsurf, Cline, VS Code, and other MCP-compatible clients.

## 🎯 Two Ways to Use DocuGen

### Option 1: For Individual Users (Personal Google Account)
Perfect for developers, writers, and professionals using their personal Google accounts.
- **Setup time**: 5 minutes
- **What you need**: Create your own Google OAuth credentials (free, we'll show you how!)
- **Best for**: Personal projects, individual use

📺 **[Watch 5-Minute Setup Video](https://youtube.com/docugen-setup)** or 📖 **[Follow Step-by-Step Guide](docs/SETUP_OAUTH.md)**

### Option 2: For Organizations (Google Workspace)
Ideal for companies deploying to teams.
- **Setup time**: IT creates one OAuth app, users just copy-paste config
- **What you need**: Google Workspace admin access
- **Best for**: Teams of 10-1000+ users

📘 **[Enterprise Setup Guide](docs/ENTERPRISE.md)**

## ✨ Features

- 🎨 **Native Google Docs Formatting** - Real Google Docs, not markdown exports
- 📝 **Professional Templates** - PRDs, tech specs, test plans, release notes
- 🤖 **Multi-Client Support** - Works with Claude, Cursor, Windsurf, Cline, VS Code
- 🔧 **Custom Templates** - Create and save your own templates
- 📊 **Tables & Lists** - Native tables, bullets, numbering with proper formatting
- 🎯 **Smart Placeholders** - Auto-fill dates, names, and custom variables

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm installed
- Any MCP-compatible client (Claude Desktop, Cursor, Windsurf, etc.)
- Google account (personal or workspace)

### Installation with NPX (Recommended)

No installation needed! DocuGen runs directly with `npx`:

```bash
# Test if it works
npx docugen-mcp --version
```

### Step 1: Set Up Google OAuth (5 minutes, one-time setup)

You need Google OAuth credentials to allow DocuGen to create documents in your account.

**🎥 Video Tutorial**: [Watch on YouTube](https://youtube.com/docugen-oauth) (5 min)

**📝 Written Guide**: [Step-by-Step with Screenshots](docs/SETUP_OAUTH.md)

<details>
<summary>Quick Steps (Click to expand)</summary>

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project called "DocuGen"
3. Enable Google Docs API and Google Drive API
4. Create OAuth credentials (Desktop app type)
5. Download as `credentials.json`
6. Save to your home directory

</details>

### Step 2: Configure Your AI Client

Choose your client below and add the configuration:

<details>
<summary>📱 Claude Desktop</summary>

**Location:**
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

**Configuration:**
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

[Full Claude Setup Guide](docs/SETUP_CLAUDE.md)
</details>

<details>
<summary>🖱️ Cursor</summary>

**Location:**
- Project: `.cursor/mcp.json`
- Global: `~/.cursor/mcp.json`

**Configuration:**
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

[Full Cursor Setup Guide](docs/SETUP_CURSOR.md)
</details>

<details>
<summary>🌊 Windsurf</summary>

**Location:** `~/.codeium/windsurf/mcp_config.json`

**Configuration:**
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

[Full Windsurf Setup Guide](docs/SETUP_WINDSURF.md)
</details>

<details>
<summary>🤖 Cline</summary>

**Location:**
- Windows: `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- Mac: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

**Configuration:**
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

[Full Cline Setup Guide](docs/SETUP_CLINE.md)
</details>

<details>
<summary>View More Clients...</summary>

- [VS Code Setup](docs/SETUP_VSCODE.md)
- [Roo Code Setup](docs/SETUP_ROO.md)
- [JetBrains IDEs Setup](docs/SETUP_JETBRAINS.md)

</details>

### Step 3: Restart Your Client & Authenticate

1. Completely quit and restart your AI client
2. When you first use DocuGen, it will open a browser
3. Sign in with Google and authorize DocuGen
4. That's it! You're ready to create documents

## 💬 How to Use

Once configured, just ask your AI assistant:

### Basic Commands
```
"Create a new Google Doc called 'Meeting Notes'"
"Make a product requirements document for our new feature"
"Generate a test plan for the checkout flow"
```

### Using Templates
```
"Create a PRD using the template"
"Make a technical spec for the API redesign"
"Generate release notes for version 2.0"
```

### Document Management
```
"List my recent Google Docs"
"Search for documents about 'roadmap'"
"Update the status in doc_id_xyz"
```

## 📚 Documentation

- 📖 [Step-by-Step OAuth Setup](docs/SETUP_OAUTH.md) - Detailed guide with screenshots
- 🏢 [Enterprise Deployment](docs/ENTERPRISE.md) - For IT administrators
- ❓ [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions
- 🎥 [Video Tutorials](docs/videos/README.md) - Visual guides for setup
- 📝 [Template Creation](docs/TEMPLATES.md) - Create custom templates

## 🎯 Built-in Templates

DocuGen includes professional templates for:

- **Product Requirements Document (PRD)** - Complete with user stories, success metrics
- **Technical Specification** - Architecture, API design, data models
- **Test Plan** - Test cases, coverage, entry/exit criteria
- **Release Notes** - Features, improvements, known issues
- **Business Case** - ROI analysis, risk assessment
- More templates in `templates/` directory

## 🔧 For Organizations

### NPX with Shared Credentials

Organizations can distribute OAuth credentials internally:

1. **IT Setup:**
   - Create one Google OAuth app in Google Cloud Console
   - Share CLIENT_ID and CLIENT_SECRET via internal docs

2. **Employee Configuration:**
```json
{
  "mcpServers": {
    "docugen": {
      "command": "npx",
      "args": ["docugen-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "company-app.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "company-oauth-secret"
      }
    }
  }
}
```

3. **Result:**
   - Each employee authenticates once with their Google account
   - Access only their own documents
   - No individual OAuth app creation needed

See [Enterprise Guide](docs/ENTERPRISE.md) for detailed instructions.

## ❓ Troubleshooting

### Common Issues

<details>
<summary>"No credentials found" error</summary>

- Make sure `credentials.json` exists in the specified path
- Check the path in your configuration is correct
- Follow the [OAuth Setup Guide](docs/SETUP_OAUTH.md) to create credentials

</details>

<details>
<summary>"APIs not enabled" error</summary>

- Go to Google Cloud Console
- Select your project
- Enable both Google Docs API and Google Drive API
- [Direct link to API Library](https://console.cloud.google.com/apis/library)

</details>

<details>
<summary>MCP server not showing in client</summary>

- Completely quit your AI client (not just close window)
- Check your configuration file for syntax errors (valid JSON)
- Ensure the path to credentials.json is absolute, not relative
- Restart your AI client

</details>

<details>
<summary>Browser doesn't open for authentication</summary>

- Check if your default browser is set
- Try running `npx docugen-mcp auth` directly in terminal
- Make sure you're not in a headless environment

</details>

More solutions in our [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

## 🤝 Support

- 📺 [Video Tutorials](https://youtube.com/@docugen)
- 💬 [GitHub Discussions](https://github.com/eagleisbatman/docugen/discussions) - Ask questions
- 🐛 [Report Issues](https://github.com/eagleisbatman/docugen/issues)
- 📧 Email: support@docugen.dev

## 📄 License

Apache License 2.0 - Free for personal and commercial use.

## 🙏 Acknowledgments

Built with [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic.

---

**Made with ❤️ by Gautam Mandewalker**

*Transform your document workflow with AI-powered Google Docs automation.*