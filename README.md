# DocuGen - Google Sheets MCP Server

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python Version](https://img.shields.io/badge/python-%3E%3D3.12-blue)](https://python.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)

A powerful Google Sheets automation server for Claude Desktop using the Model Context Protocol (MCP). Create spreadsheets, analyze data, build dashboards, and automate workflows with 60+ operations.

## 🚀 What is DocuGen?

DocuGen enables Claude to create and manipulate Google Sheets programmatically. Instead of manually clicking through spreadsheets, just tell Claude what you need in plain English:

- "Create a budget tracker for my personal finances"
- "Import this CSV data and create a sales dashboard"
- "Build an inventory management system with reorder alerts"

## ✨ Features

### 60+ Google Sheets Operations
- **Spreadsheet Management**: Create, batch update, get metadata
- **Data Operations**: Read, write, append, clear, import CSV/JSON
- **Formatting**: Cell styles, borders, merging, conditional formatting
- **Advanced Features**: Pivot tables, charts, data validation, filters
- **Sheet Management**: Add, delete, duplicate, rename, hide/show sheets
- **Protection**: Lock ranges, protect sheets, manage permissions
- **Formulas**: Add complex formulas, named ranges, calculations

### Smart Templates
- Budget trackers with income/expense categories
- Financial dashboards with KPIs and charts
- Project management with Gantt charts
- Inventory systems with automatic reorder alerts
- CRM systems with contact and deal tracking
- Event planning templates
- Loan calculators with amortization schedules

## 📋 Prerequisites

- Python 3.12 or higher
- Google Cloud account (free tier works)
- Claude Desktop app
- 5 minutes for setup

## 🛠️ Installation

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/eagleisbatman/docugen.git
cd docugen

# Create virtual environment (recommended)
python3.12 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install git+https://github.com/modelcontextprotocol/python-sdk.git
```

### Step 2: Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable **Google Sheets API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click and enable it

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop app" as application type
   - Download the JSON file
   - Save it somewhere secure (e.g., `~/Desktop/credentials.json`)

### Step 3: Configure Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docugen": {
      "command": "python3.12",
      "args": [
        "/absolute/path/to/docugen/docugen_mcp_server.py"
      ],
      "env": {
        "GOOGLE_OAUTH_PATH": "/path/to/your/credentials.json"
      }
    }
  }
}
```

Replace paths with your actual paths!

### Step 4: Restart Claude Desktop

Completely quit and restart Claude Desktop. You should see the MCP icon (🔌) in the chat interface.

### Step 5: (Recommended) Set Up a DocuGen Project

For best results, create a dedicated project in Claude Desktop:

1. In Claude Desktop, create a new Project
2. Go to Project Settings → Custom Instructions
3. Copy the content from [DOCUGEN_SYSTEM_PROMPT.md](docs/DOCUGEN_SYSTEM_PROMPT.md)
4. Paste it into the project instructions
5. Save the project as "DocuGen" or "Spreadsheets"

Now every conversation in this project will have full knowledge of DocuGen's capabilities!

## 💬 Usage Examples

### Creating a Budget Tracker
```
"Create a personal budget tracker with income, expenses, and monthly summary"
```

### Importing CSV Data
```
"Import this CSV data and analyze it:
Date,Product,Sales,Quantity
2024-01-15,Widget A,1500,50
2024-01-16,Widget B,2300,75
Create a pivot table and sales chart"
```

### Building a Dashboard
```
"Create a financial dashboard for Q4 2024 with revenue tracking, expense categories, and KPI metrics"
```

### Project Management
```
"Build a project tracker with task list, timeline, status tracking, and Gantt chart visualization"
```

## 🧪 Testing

Test the server installation:

```bash
# Test with example script
cd docugen
python3.12 examples/test_server.py

# You should see:
# ✓ Server module imported successfully
# ✓ FastMCP server instance found
# ✓ Found 91 callable functions in module
# ✓ Found 6/6 key operations as functions
```

## 📁 Project Structure

```
docugen/
├── docugen_mcp_server.py    # Main server (3700+ lines, 60+ operations)
├── requirements.txt         # Python dependencies
├── docs/
│   ├── CLAUDE.md           # Development guide
│   ├── SETUP_GUIDE.md      # Detailed setup instructions
│   ├── DOCUGEN_SYSTEM_PROMPT.md  # Claude's instructions
│   └── DOCUGEN_USER_PROMPTS.md   # Example prompts
└── examples/
    ├── claude_desktop_config.json  # Example configuration
    ├── test_server.py              # Test script
    └── usage_example.py            # Usage examples
```

## 🔧 How It Works

1. **You tell Claude** what you want in natural language
2. **Claude understands** your business need
3. **DocuGen executes** the appropriate Google Sheets operations
4. **You get** a professional spreadsheet without writing code

### Technical Details

- Uses **FastMCP** framework for efficient MCP implementation
- **OAuth 2.0** authentication with Google
- Token stored securely in `~/.docugen/sheets_token.json`
- All operations in a single, well-organized file
- Comprehensive error handling and validation

## 🚨 Important Notes

- **CSV Import**: Users must paste data as text (Claude can't access local files)
- **Permissions**: First run opens browser for Google authorization
- **Spreadsheet IDs**: Claude provides the ID after creating spreadsheets
- **Operations**: Claude can create, read, update, format - but not delete entire spreadsheets

## 🐛 Troubleshooting

### Server doesn't appear in Claude Desktop
- Ensure paths in config are absolute, not relative
- Check Python version: `python3.12 --version`
- Restart Claude Desktop completely
- Verify credentials file exists

### Authentication issues
- Ensure Google Sheets API is enabled
- Check OAuth consent screen is configured
- Verify you're using Desktop app credentials

### Import errors
```bash
# Reinstall MCP SDK
pip uninstall mcp
pip install git+https://github.com/modelcontextprotocol/python-sdk.git
```

## 📚 Resources

### Getting Started
- [SETUP_GUIDE.md](docs/SETUP_GUIDE.md) - Detailed setup walkthrough with screenshots
- [DOCUGEN_USER_PROMPTS.md](docs/DOCUGEN_USER_PROMPTS.md) - 50+ example prompts to try

### Optimizing Claude's Performance
- [DOCUGEN_SYSTEM_PROMPT.md](docs/DOCUGEN_SYSTEM_PROMPT.md) - Add to Claude Desktop project instructions for best results (includes 12 detailed workflow examples)

## 🤝 Contributing

Contributions welcome! The codebase is a single file (`docugen_mcp_server.py`) with 60+ well-organized operations.

To add new operations:
1. Add your function to `docugen_mcp_server.py`
2. Decorate with `@mcp.tool()`
3. Follow the existing pattern for parameters and returns
4. Test with `examples/test_server.py`

## 📄 License

Apache-2.0 License - see [LICENSE](LICENSE) file

## 👨‍💻 Author

**Created by Gautam Mandewalker**

📍 Cumming, Forsyth County, Georgia, USA

🔗 [GitHub](https://github.com/eagleisbatman) | [LinkedIn](https://www.linkedin.com/in/gautammandewalker/)

## 🙏 Acknowledgments

- Built with [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic
- Uses [FastMCP](https://github.com/modelcontextprotocol/python-sdk) framework
- Powered by Google Sheets API v4

## 📊 Status

✅ **Production Ready**
- 91 tools available (60+ unique operations)
- Single-file architecture for simplicity
- FastMCP framework for performance
- Comprehensive error handling
- Ready for immediate use with Claude Desktop