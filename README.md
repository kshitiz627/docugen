# DocuGen 📄

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)
[![Google APIs](https://img.shields.io/badge/Google%20APIs-Docs%20%26%20Drive-4285F4)](https://developers.google.com/docs/api)

**Create beautiful Google Docs with AI-powered templates and native formatting through the Model Context Protocol.**

DocuGen is an MCP server that empowers AI assistants like Claude to create professional Google Docs with rich formatting, templates, and automation. No more markdown exports or manual formatting—get real Google Docs with native styles, tables, and layouts.

## ✨ Features

### 🎯 Core Capabilities
- **Native Google Docs Creation** - Generate documents with real Google Docs formatting
- **Professional Templates** - Built-in templates for PRDs, tech specs, test plans, and more
- **Rich Formatting** - Headers, tables, lists, colors, alignment—all native to Google Docs
- **Document Management** - List, search, update, and organize your documents
- **Personal Templates** - Create and save your own custom templates

### 📝 Built-in Templates
- Product Requirements Document (PRD)
- Technical Specification
- Test Plan
- Release Notes
- Sprint Planning
- Bug Report
- Business Case
- Architecture Review
- *...and easily add your own!*

### 🎨 Formatting Features
- Multiple heading levels with custom styles
- Tables with formatted cells
- Bulleted and numbered lists
- Text styling (bold, italic, underline)
- Custom fonts and sizes
- Color formatting
- Paragraph alignment
- Automatic placeholders

## 🚀 Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- npm or yarn
- Claude Desktop app
- Google account

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/eagleisbatman/docugen.git
cd docugen
```

2. **Install dependencies**
```bash
npm install
```

3. **Build the project**
```bash
npm run build
```

4. **Set up Google OAuth**

You need to create your own Google Cloud project to use this server:

**Step-by-step OAuth Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Enable APIs:
   - Search for "Google Docs API" → Enable
   - Search for "Google Drive API" → Enable
4. Create credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, configure the OAuth consent screen first:
     - Choose "External" (or "Internal" for Google Workspace)
     - Fill in app name: "DocuGen MCP"
     - Add your email as support contact
     - Add scopes: `../auth/documents`, `../auth/drive`
   - For Application type, choose "Desktop app"
   - Name it "DocuGen MCP Client"
   - Download the credentials JSON file
   - Save it as `credentials.json` in the project root

**Note:** The first time you run the server, it will open a browser window for you to authorize access to your Google account. The authorization token will be saved locally for future use.

5. **Configure Your AI Client**

DocuGen works with any MCP-compatible client. Here's how to set it up:

### For Claude Desktop (macOS)

Edit the config file at `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docugen": {
      "command": "node",
      "args": ["/absolute/path/to/docugen/build/server.js"]
    }
  }
}
```

**Important:** Replace `/absolute/path/to/docugen` with the actual path where you cloned the repository.

### For Claude Desktop (Windows)

Edit the config file at `%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docugen": {
      "command": "node",
      "args": ["C:\\path\\to\\docugen\\build\\server.js"]
    }
  }
}
```

### For Other MCP Clients

Refer to your client's documentation for adding MCP servers. You'll need:
- **Command:** `node`
- **Arguments:** `["/path/to/docugen/build/server.js"]`

6. **Restart Your AI Client**

After updating the configuration, completely quit and restart your AI client (e.g., Claude Desktop).

7. **First Run - Google Authorization**

When you first use DocuGen commands in your AI client:
1. The server will automatically open your browser
2. Log in to your Google account
3. Review the permissions (access to create/edit Google Docs)
4. Click "Allow" to authorize
5. The browser will show "Authorization successful"
6. Return to your AI client - you're ready to use DocuGen!

The authorization token is saved locally, so you only need to do this once.

## 💬 Usage Examples

### Basic Document Creation
```
"Create a new document titled 'Q4 Planning'"
"Make a Google Doc with our meeting notes"
```

### Using Templates
```
"Create a PRD for our new search feature"
"Generate a technical spec document for the authentication system"
"Make a test plan for the checkout flow"
```

### Document Management
```
"List all my Google Docs"
"Search for documents containing 'roadmap'"
"Update the status section in document [docId]"
```

### Custom Formatting
```
"Create a document with a table comparing our pricing plans"
"Make a formatted report with headers, bullet points, and highlighted sections"
```

### Template Management
```
"Show me available templates"
"Save this structure as a template called 'weekly-report'"
"Clone the PRD template and customize it for mobile apps"
```

## 🛠️ Development

### Project Structure
```
docugen/
├── src/
│   └── server.ts          # Main MCP server implementation
├── templates/
│   └── standard/          # Built-in templates
│       ├── product-manager/
│       │   └── prd.json
│       └── engineering/
│           └── tech-spec.json
├── build/                 # Compiled JavaScript
├── package.json
├── tsconfig.json
└── CLAUDE.md             # Instructions for Claude Code
```

### Commands
- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Watch mode for development
- `npm start` - Run the compiled server

### Creating Custom Templates

Templates are JSON files with a specific structure. Create them in `~/.docgen/templates/`:

```json
{
  "id": "my-template",
  "name": "My Custom Template",
  "description": "Description of the template",
  "sections": [
    {
      "type": "heading",
      "content": "{{title}}",
      "level": 1,
      "style": {
        "bold": true,
        "fontSize": 24
      }
    },
    {
      "type": "paragraph",
      "content": "{{introduction}}"
    }
  ]
}
```

### Template Placeholders
- `{{variable}}` - Basic placeholder
- `{{date}}` - Auto-fills current date
- `{{time}}` - Auto-fills current time
- `{{year}}` - Auto-fills current year

## 🔧 Configuration

### Environment Variables
- `MCP_USER_TEMPLATES_PATH` - Custom templates directory (optional)

### File Locations
- **Credentials**: `./credentials.json` (your Google OAuth credentials)
- **Token**: `./token.json` (auto-generated after first authorization)
- **User Templates**: `~/.docgen/templates/` (default location for custom templates)

## 🔍 Troubleshooting

### Common Issues

**"No authentication configured" error**
- Make sure you've created and downloaded the `credentials.json` file from Google Cloud Console
- Verify the file is in the project root directory

**"Cannot find module" error**
- Run `npm install` to install dependencies
- Run `npm run build` to compile TypeScript files
- Make sure the path in your client config points to `build/server.js`, not `src/server.ts`

**MCP server not showing in Claude**
- Completely quit Claude Desktop (not just close the window)
- Check your config file syntax - it must be valid JSON
- Verify the absolute path to `server.js` is correct
- Restart Claude Desktop

**Google authorization opens but fails**
- Make sure you've enabled both Google Docs API and Google Drive API
- Check that your OAuth consent screen is configured
- Try deleting `token.json` and re-authorizing

**"Insufficient permissions" errors**
- The OAuth app needs access to Google Docs and Drive
- Check the scopes in your OAuth configuration
- Delete `token.json` and re-authorize with correct permissions

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Ways to Contribute
- 🐛 Report bugs and issues
- 💡 Suggest new features
- 📝 Create new templates
- 🔧 Submit pull requests
- 📚 Improve documentation
- ⭐ Star the repository

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with the [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
- Powered by [Google Docs API](https://developers.google.com/docs/api) and [Google Drive API](https://developers.google.com/drive/api)
- Special thanks to the MCP community

## 🔗 Links

- [Documentation](https://github.com/eagleisbatman/docugen/wiki)
- [Issues](https://github.com/eagleisbatman/docugen/issues)
- [Discussions](https://github.com/eagleisbatman/docugen/discussions)
- [Model Context Protocol](https://modelcontextprotocol.io)

## 🚦 Status

- ✅ Core functionality implemented
- ✅ Google OAuth integration
- ✅ Template system
- ✅ Rich formatting support
- 🚧 Additional templates in progress
- 📋 Planned: Batch operations
- 📋 Planned: Template marketplace

---

**Made with ❤️ by Gautam Mandewalker**

*Transform your document workflow with AI-powered Google Docs automation.*