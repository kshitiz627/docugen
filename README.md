# 🚀 DocuGen MCP Server

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org)
[![npm version](https://img.shields.io/npm/v/docugen-mcp.svg)](https://www.npmjs.com/package/docugen-mcp)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)
[![Google APIs](https://img.shields.io/badge/Google%20APIs-Docs%20%26%20Drive-4285F4)](https://developers.google.com/docs/api)

**🎯 Transform your AI assistant into a Google Docs powerhouse. Create beautiful, natively-formatted documents with templates and automation.**

## 📋 Table of Contents

- [About](#-about)
- [Why DocuGen?](#-why-docugen)
- [Supported AI Assistants](#-supported-ai-assistants)
- [Installation](#-installation)
- [Installing Node.js](#-installing-nodejs)
- [Setup Guide](#-setup-guide)
- [Usage Examples](#-usage-examples)
- [Available Templates](#-available-templates)
- [For Organizations](#-for-organizations)
- [Troubleshooting](#-troubleshooting)
- [Author](#-author)

## 🎨 About

DocuGen is a Model Context Protocol (MCP) server that empowers AI assistants to create professional Google Docs with native formatting. Unlike traditional markdown exports, DocuGen creates real Google Docs with proper tables, headings, lists, and styling - all through simple conversational commands.

### What Makes DocuGen Special?

- **🎯 Native Google Docs** - Not markdown conversions, but real Google Docs with all formatting features
- **📝 Professional Templates** - Built-in templates for PRDs, tech specs, test plans, and more
- **🤖 Universal Compatibility** - Works with Claude, Cursor, Windsurf, Cline, and other MCP-compatible AI assistants
- **🔒 Secure & Private** - Each user authenticates individually and accesses only their own documents
- **⚡ Zero Installation** - Runs directly with npx, no complex setup required
- **🏢 Enterprise Ready** - Simple deployment for teams of any size

## 🤔 Why DocuGen?

**The Problem:** AI assistants can write great content, but getting it into a properly formatted Google Doc requires manual copying, pasting, and reformatting.

**The Solution:** DocuGen gives your AI assistant direct access to create and manage Google Docs with native formatting, templates, and automation.

**Real-World Use Cases:**
- Product managers creating PRDs directly from requirements discussions
- Engineers generating technical specifications with proper formatting
- QA teams producing test plans with structured tables
- Teams collaborating on documents without leaving their AI workflow

## 🤖 Supported AI Assistants

DocuGen works with all major AI coding assistants that support the Model Context Protocol:

### Claude Desktop
The official Anthropic desktop application with full MCP support.

### Claude Code
Anthropic's CLI-based coding assistant with powerful MCP integration.

### Cursor
The AI-first code editor built for pair programming with AI.

### Windsurf
The IDE that brings AI agents directly into your development workflow.

### Cline (Premium VS Code Extension)
Autonomous coding agent in VS Code that edits files, executes commands, and uses MCP servers for extended capabilities. One of the most respected open-source AI coding assistants.

### Roo Code
Enhanced autonomous programming assistant based on Cline, offering multi-mode AI agents (Architect, Coder, Debugger) with experimental features.

### Kilo Code
Open-source AI coding assistant that's a superset of both Roo and Cline, featuring an MCP Server Marketplace and orchestrator mode for complex projects.

## 💾 Installation

```bash
# No installation needed - runs directly with npx
npx docugen-mcp --version

# To verify it's working
npx docugen-mcp --help
```

## 📦 Installing Node.js

DocuGen requires Node.js 16 or higher. If you don't have Node.js installed, follow these instructions:

### Windows

**Option 1: Official Installer (Recommended)**
1. Visit [nodejs.org](https://nodejs.org)
2. Download the Windows Installer (.msi) for the LTS version
3. Run the installer with administrator privileges
4. Follow the installation wizard (npm is included automatically)
5. Restart your computer
6. Open Command Prompt and verify: `node --version` and `npm --version`

**Option 2: Using Chocolatey**
```powershell
# If you have Chocolatey installed
choco install nodejs
```

### macOS

**Option 1: Using Homebrew (Recommended)**
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node
```

**Option 2: Official Installer**
1. Visit [nodejs.org](https://nodejs.org)
2. Download the macOS Installer (.pkg)
3. Run the installer
4. Verify in Terminal: `node --version` and `npm --version`

### Linux

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install nodejs npm
```

**Fedora/RHEL/CentOS:**
```bash
sudo dnf install nodejs npm
```

**Arch Linux:**
```bash
sudo pacman -S nodejs npm
```

### Verification
After installation, verify both Node.js and npm are working:
```bash
node --version  # Should show v16.0.0 or higher
npm --version   # Should show 8.0.0 or higher
```

## 🔧 Setup Guide

### Step 1: Create Google OAuth Credentials (5 minutes)

1. **Go to Google Cloud Console**
   - Visit https://console.cloud.google.com
   - Sign in with your Google account

2. **Create a New Project**
   - Click "Select a project" dropdown → "NEW PROJECT"
   - Name it: `DocuGen`
   - Click "CREATE" and wait 10 seconds

3. **Enable Required APIs**
   - Click ☰ (menu) → "APIs & Services" → "Library"
   - Search and enable: **Google Docs API**
   - Search and enable: **Google Drive API**

4. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" → "OAuth consent screen"
   - Choose "External" (or "Internal" for Google Workspace)
   - Fill in:
     - App name: `DocuGen MCP`
     - User support email: Your email
     - Developer contact: Your email
   - Click "SAVE AND CONTINUE" through all steps

5. **Create OAuth Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Application type: **Desktop app**
   - Name: `DocuGen Desktop`
   - Click "CREATE"

6. **Download Credentials**
   - Click "DOWNLOAD JSON" from the popup
   - Save as `credentials.json` in your home directory

### Step 2: Configure Your AI Assistant

Choose your AI assistant below and add the appropriate configuration:

#### 🤖 Claude Desktop

**Configuration File Location:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

#### 💻 Claude Code

**Add MCP server via CLI:**
```bash
# For user scope (available across all projects)
claude mcp add docugen --scope user -- npx docugen-mcp

# For project scope (specific to current project)
claude mcp add docugen --scope project -- npx docugen-mcp
```

**Or edit configuration directly:**
- **User config:** `~/.claude/claude_desktop_config.json`
- **Project config:** `.claude/claude_desktop_config.json`

#### 🎯 Cursor

**Global Configuration:** `~/.cursor/mcp.json`
**Project Configuration:** `.cursor/mcp.json`

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

#### 🌊 Windsurf

**Configuration File:** `~/.codeium/windsurf/mcp_config.json`

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

**Note:** Windsurf only supports global configuration, not project-specific.

#### 🚀 Cline (Premium VS Code Extension)

**Configuration File Locations:**
- **macOS:** `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- **Windows:** `%APPDATA%\Code\User\globalStorage\saoudrizwan.claude-dev\settings\cline_mcp_settings.json`
- **Linux:** `~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`

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

**Alternative:** Access via Cline's MCP Servers icon in the top navigation bar.

#### 🦘 Roo Code

**Configuration File Locations:**
- **macOS:** `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
- **Windows:** `%APPDATA%\Code\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`
- **Linux:** `~/.config/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`

Use the same JSON configuration as Cline above. Access MCP settings through Roo Code's control panel.

#### ⚡ Kilo Code

**Configuration:**
1. Install Kilo Code from VS Code Marketplace
2. Sign in with Google account at kilocode.ai
3. Access MCP Server Marketplace from the extension
4. Add DocuGen with the same configuration as above

Kilo Code features an MCP Server Marketplace for easy installation and management.

### Step 3: Start Using DocuGen

1. **Restart your AI assistant completely**
2. **Test the connection:** Ask your AI: "Create a new Google Doc called Test"
3. **First-time authentication:** A browser will open - sign in with Google
4. **Success!** You're ready to create documents

## 💬 Usage Examples

### Basic Document Operations
```
"Create a new Google Doc called 'Q4 Planning Meeting'"
"List my recent Google Docs"
"Search for documents containing 'roadmap'"
"Update the introduction in document ABC123"
```

### Using Templates
```
"Create a PRD for our new search feature"
"Generate a technical specification for the payment API"
"Make a test plan for the checkout flow"
"Create release notes for version 2.5"
```

### Advanced Formatting
```
"Create a document with a table comparing our pricing tiers"
"Make a report with sections, bullet points, and highlighted text"
"Generate a business case with financial tables"
```

## 📑 Available Templates

DocuGen includes professional templates ready to use:

- **Product Requirements Document (PRD)** - User stories, success metrics, requirements
- **Technical Specification** - Architecture, API design, data models
- **Test Plan** - Test cases, coverage, entry/exit criteria
- **Release Notes** - Features, improvements, known issues
- **Business Case** - ROI analysis, risk assessment, recommendations

Simply ask: "Create a [template name] for [your topic]"

## 🏢 For Organizations

Deploying DocuGen for your team is simple and secure.

### IT Setup (10 minutes)

1. **Create ONE OAuth App**
   - Follow Step 1 from the Setup Guide above
   - Note the CLIENT_ID and CLIENT_SECRET from your OAuth app

2. **Share with Employees**
   ```
   Subject: DocuGen - AI Document Creation Tool
   
   Setup Instructions:
   1. Install Node.js from https://nodejs.org (if not installed)
   2. Copy the configuration below to your AI assistant
   3. Replace GOOGLE_OAUTH_PATH with:
      - GOOGLE_CLIENT_ID: "your-company.apps.googleusercontent.com"
      - GOOGLE_CLIENT_SECRET: "your-company-secret"
   4. Restart your AI assistant
   5. On first use, sign in with your company Google account
   ```

### Security & Privacy

**How it works:** The OAuth app is just DocuGen's identity. Each employee:
1. Uses the shared OAuth credentials
2. Logs in with their personal Google account
3. Gets their own access token (stored locally)
4. Can only access their own documents

**Think of it like:** A building's keycard system - same card printer (OAuth app), but each person's card (token) only opens their office.

## ❓ Troubleshooting

### Common Issues

**"No credentials found"**
- Verify `credentials.json` exists at the specified path
- Check for typos in the file path
- Ensure using forward slashes (/) even on Windows

**"APIs not enabled"**
- Return to Google Cloud Console
- Verify both Google Docs API and Drive API show "Enabled"
- Make sure you're in the correct project

**MCP server not appearing**
- Completely quit and restart your AI assistant
- Validate JSON syntax in configuration file
- Check file permissions on credentials.json

**Browser doesn't open for authentication**
- Run `npx docugen-mcp` directly in terminal
- Check default browser settings
- Ensure not running in headless environment

**"Token expired or revoked"**
- Delete `~/.docugen/token.json`
- Restart AI assistant to re-authenticate
- Check if OAuth app is still active in Google Cloud Console

## 🌟 Features

- ✅ **Native Google Docs** - Real formatting, not markdown exports
- ✅ **Professional Templates** - Industry-standard document templates
- ✅ **Multi-Client Support** - Works with all major AI assistants
- ✅ **Secure Authentication** - OAuth 2.0 with individual user tokens
- ✅ **Zero Dependencies** - Runs with npx, no installation needed
- ✅ **Enterprise Ready** - Simple deployment for organizations
- ✅ **Custom Templates** - Create and save your own templates
- ✅ **Document Management** - List, search, update existing docs

## 📋 Requirements

- Node.js 16.0.0 or higher
- npm (comes with Node.js)
- Google account (personal or Google Workspace)
- Any MCP-compatible AI assistant

## 📄 License

Apache License 2.0 - Free for personal and commercial use

## 👨‍💻 Author

**Created with ❤️ by Gautam Mandewalker**

📍 **Location:** Cumming, Forsyth County, Georgia, USA

🔗 **Connect:**
- GitHub: [@eagleisbatman](https://github.com/eagleisbatman)
- LinkedIn: [Gautam Mandewalker](https://www.linkedin.com/in/gautammandewalker/)
- Email: support@docugen.dev

---

### 🌟 Support the Project

If DocuGen helps your workflow, please consider:
- ⭐ Starring this repository
- 🐛 Reporting issues or bugs
- 💡 Suggesting new features
- 📣 Sharing with your team

**Transform your AI conversations into beautiful Google Docs. Start with DocuGen today!**

---

*Need help? Open an issue at [github.com/eagleisbatman/docugen/issues](https://github.com/eagleisbatman/docugen/issues)*