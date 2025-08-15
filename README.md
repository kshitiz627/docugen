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

### 🎯 NEW: Simplified Markdown Approach
DocuGen now supports creating documents from GitHub-flavored markdown - the format AI assistants naturally generate:

```
"Create a document with this markdown content:
# Project Proposal
## Executive Summary
This project aims to improve our search functionality.

## Features
- Advanced filtering
- Real-time results
- Search history

## Timeline
| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Design | 2 weeks | Mockups |
| Development | 4 weeks | Beta version |
| Testing | 1 week | Final release |
"
```

**Why Markdown?**
- **Natural for AI:** AI assistants already generate markdown naturally
- **Reliable:** Simple text format that always works
- **Full Formatting:** Supports headings, lists, tables, code blocks, quotes
- **GitHub Compatible:** Same markdown you use in README files
- **One-shot Creation:** Send entire document at once, no complex operations

**Supported Markdown Features:**
- Headings (# ## ### etc.)
- Bold (**text**) and italic (*text*)
- Bullet lists (- item) and numbered lists (1. item)
- Tables with pipes (|col1|col2|)
- Code blocks with ``` 
- Blockquotes with >
- Horizontal rules with ---

The AI can simply generate the document content in markdown format and DocuGen will create a properly formatted Google Doc with native formatting.

## 📑 Available Templates

DocuGen includes professional templates ready to use:

- **Product Requirements Document (PRD)** - User stories, success metrics, requirements
- **Technical Specification** - Architecture, API design, data models
- **Test Plan** - Test cases, coverage, entry/exit criteria
- **Release Notes** - Features, improvements, known issues
- **Business Case** - ROI analysis, risk assessment, recommendations

Simply ask: "Create a [template name] for [your topic]"

## 🏢 For Organizations

Deploy DocuGen for your entire team with one simple setup. Each employee maintains private access to their own documents.

### 👔 What IT Team Does (One-time, 15 minutes)

#### 1. Create Google OAuth App
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: "DocuGen for [Company Name]"
3. Enable APIs:
   - Google Docs API
   - Google Drive API
4. Configure OAuth consent screen:
   - Type: Internal (for Google Workspace) or External
   - App name: "DocuGen - [Company Name]"
   - Add your company domain to authorized domains
5. Create OAuth credentials:
   - Type: Desktop application
   - Name: "DocuGen Desktop"
6. Download and save the CLIENT_ID and CLIENT_SECRET

#### 2. Prepare Employee Configuration
Create a configuration template with your company's OAuth credentials:

```json
{
  "mcpServers": {
    "docugen": {
      "command": "npx",
      "args": ["docugen-mcp"],
      "env": {
        "GOOGLE_CLIENT_ID": "123456789-abc.apps.googleusercontent.com",
        "GOOGLE_CLIENT_SECRET": "GOCSPX-YourCompanySecret"
      }
    }
  }
}
```

#### 3. Send Instructions to Employees
```
Subject: DocuGen Setup - AI Document Assistant Ready

Hello Team,

We've set up DocuGen to help you create Google Docs directly from your AI assistant.
Setup takes just 2 minutes:

PREREQUISITES:
- Install Node.js from https://nodejs.org (LTS version)
- Have your AI assistant installed (Claude, Cursor, Windsurf, etc.)

SETUP STEPS:
1. Copy the configuration below
2. Paste it into your AI assistant's config file (see locations below)
3. Restart your AI assistant completely
4. Test by asking: "Create a new Google Doc called Test"
5. Sign in with your company Google account when prompted (first time only)

[Include the JSON configuration here]

CONFIG FILE LOCATIONS:
- Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json (Mac)
                 %APPDATA%\Claude\claude_desktop_config.json (Windows)
- Cursor: ~/.cursor/mcp.json
- Windsurf: ~/.codeium/windsurf/mcp_config.json
- See full list: https://github.com/eagleisbatman/docugen#supported-ai-assistants

Need help? Contact IT Support
```

### 👩‍💼 What Each Employee Does (One-time, 2 minutes)

#### Step 1: Install Prerequisites
- **Node.js**: Download from [nodejs.org](https://nodejs.org) if not installed
- **AI Assistant**: Claude Desktop, Cursor, Windsurf, or other MCP-compatible client

#### Step 2: Add Configuration
1. Open your AI assistant's configuration file:
   - **Mac Claude**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows Claude**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Other assistants**: See documentation above
2. Paste the configuration provided by IT
3. Save the file

#### Step 3: Start Using
1. Completely restart your AI assistant (quit and reopen)
2. Test: "Create a new Google Doc called Team Meeting Notes"
3. First time: Browser opens → Sign in with your company Google account
4. Done! Your AI can now create and manage your Google Docs

### 🔒 Security & Privacy Explained

**For IT Teams:**
- OAuth app acts as the application identifier only
- No service accounts or shared drives needed
- Each user's token is stored locally on their machine
- Tokens are isolated per user in `~/.docugen/token.json`
- No central storage or logging of user documents

**For Employees:**
- You sign in with YOUR Google account
- You see only YOUR documents
- Your access token stays on YOUR computer
- Even though everyone uses the same OAuth app, each person's login determines their access

**Simple Analogy:** 
Think of the OAuth app like your company's email server. Everyone uses the same email server (OAuth app), but each person logs in with their own credentials and can only see their own emails (documents).

### 📊 Deployment Checklist for IT

- [ ] Created Google Cloud project
- [ ] Enabled Google Docs and Drive APIs
- [ ] Created OAuth 2.0 credentials (Desktop app)
- [ ] Saved CLIENT_ID and CLIENT_SECRET
- [ ] Created configuration template for employees
- [ ] Sent setup instructions to team
- [ ] Tested with one pilot user
- [ ] Rolled out to all employees

### 🆘 Enterprise Support

#### For IT Teams

**Can we restrict which employees can use this?**  
Yes. In Google Cloud Console, configure your OAuth consent screen to limit access by domain or specific user groups in your Google Workspace.

**How do we monitor usage?**  
Google Cloud Console provides detailed API usage metrics. Navigate to APIs & Services → Metrics to view request counts, error rates, and quota usage.

**Can employees access shared drives?**  
Yes. Employees can access any shared drives they have permissions for in Google Workspace. DocuGen respects existing Google Drive permissions.

**What happens when an employee leaves?**  
No action required. When their Google account is deactivated, their local token automatically becomes invalid and they lose access.

#### For Employees

**MCP server not appearing in AI assistant**  
• Completely quit and restart your AI assistant  
• Verify the configuration was saved correctly  
• Check that Node.js is installed: run `node --version` in terminal

**Browser doesn't open for Google sign-in**  
• Run `npx docugen-mcp` directly in your terminal  
• Check if your default browser is set correctly  
• Ensure you're not on a remote/headless system

**"Authentication failed" error**  
• Delete the token file: `rm ~/.docugen/token.json` (Mac/Linux) or delete `%USERPROFILE%\.docugen\token.json` (Windows)  
• Restart your AI assistant and try again  
• Ensure you're signing in with your company Google account

**Can't see or create documents**  
• Verify you signed in with your company Google account (not personal)  
• Check with IT that Google Docs API is enabled  
• Ensure you have Google Workspace access

## ❓ Troubleshooting

### Configuration Issues

**No credentials found**  
• For individual users: Verify `credentials.json` exists at the path specified in GOOGLE_OAUTH_PATH  
• For enterprise: Check that GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set correctly  
• Use forward slashes (/) in paths, even on Windows

**APIs not enabled**  
• Go to Google Cloud Console → APIs & Services → Library  
• Search for "Google Docs API" and "Google Drive API"  
• Ensure both show "API Enabled" with a green checkmark

**MCP server not appearing**  
• Quit your AI assistant completely (not just close the window)  
• Validate JSON syntax using a JSON validator  
• Check file permissions: the config file should be readable

### Authentication Issues

**Browser doesn't open for sign-in**  
• Try running `npx docugen-mcp` directly in terminal to test  
• Check your default browser is set in system settings  
• For remote systems, you'll need to use credentials.json method

**Token expired or revoked**  
• Delete the token file: `~/.docugen/token.json`  
• Restart your AI assistant to trigger re-authentication  
• Verify the OAuth app is still active in Google Cloud Console

### Runtime Issues

**Can't create or access documents**  
• Ensure you're signed in with the correct Google account  
• Verify you have edit permissions for Google Docs  
• Check quota limits in Google Cloud Console (free tier: 60 requests/minute)

**"Permission denied" errors**  
• For shared drives: verify you have access in Google Drive  
• For personal docs: ensure you're the owner or have edit access  
• Check OAuth consent screen includes required scopes

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