# CLAUDE.md - Local Development Guide

This file provides guidance for Claude AI when working with the DocuGen MCP codebase locally.

## Project Overview

DocuGen is a comprehensive Google Sheets MCP server that provides 60+ operations for complete spreadsheet automation. The project has been completely rewritten in Python following MCP best practices with a modular architecture.

## Current Implementation

The project uses:
- **Python 3.10+** with async/await
- **Official MCP SDK** from Anthropic
- **Google Sheets API v4** for all operations
- **Modular architecture** with clear separation of concerns
- **Security-first design** with validation and sanitization

## File Structure

```
docugen/
├── src/
│   └── docugen/                    # Main Python package
│       ├── server.py               # MCP server implementation
│       ├── main.py                 # Entry point
│       ├── config.py               # Configuration management
│       ├── core/                   # Core functionality
│       ├── operations/             # 60+ Google Sheets operations
│       ├── models/                 # Data models
│       ├── security/               # Security features
│       └── utils/                  # Utilities
├── test_server.py                  # Test script
├── claude_desktop_config.json      # Claude Desktop config
└── requirements.txt                # Python dependencies
```

## Key Commands

### Install dependencies:
```bash
pip install -r requirements.txt
pip install git+https://github.com/modelcontextprotocol/python-sdk.git
```

### Test the server structure:
```bash
GOOGLE_OAUTH_PATH="/tmp/dummy_credentials.json" python3 test_server.py
```

### Run the server:
```bash
GOOGLE_OAUTH_PATH="/path/to/credentials.json" python3 src/docugen/main.py
```

## Development Workflow

1. **Making Changes**: Edit files in `src/docugen/`
2. **Test Structure**: Run `test_server.py` with dummy credentials
3. **Test with Real Auth**: Use actual Google OAuth credentials
4. **Test in Claude Desktop**: Update `claude_desktop_config.json`
5. **Package**: Prepare for PyPI publication (when ready)

## Authentication

The server uses OAuth 2.0 for Google Sheets API access:
- Credentials are read from `GOOGLE_OAUTH_PATH` environment variable
- Token is stored in `~/.docugen/token.json`
- First run requires OAuth flow completion
- Token automatically refreshes when expired

## Testing in Claude Desktop

Configure `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docugen": {
      "command": "python3",
      "args": ["/absolute/path/to/src/docugen/main.py"],
      "env": {
        "GOOGLE_OAUTH_PATH": "/path/to/credentials.json",
        "PYTHONPATH": "/absolute/path/to/src"
      }
    }
  }
}
```

## Module Organization

### Core Modules
- `server.py` - Main MCP server with protocol handlers
- `config.py` - Configuration and environment management
- `core/auth.py` - Google OAuth authentication
- `core/client.py` - Google Sheets API client

### Operations (60+ total)
Each module contains related operations:
- `operations/spreadsheet.py` - Spreadsheet-level operations
- `operations/values.py` - Cell value operations
- `operations/sheets.py` - Sheet management
- `operations/formatting.py` - Cell formatting
- `operations/dimensions.py` - Row/column operations
- `operations/filters.py` - Filter and sort operations
- `operations/charts.py` - Chart and visualization
- `operations/validation.py` - Data validation
- `operations/protection.py` - Range protection
- `operations/import_export.py` - Import/export operations
- `operations/batch.py` - Batch operations

### Security Features
- `security/validators.py` - Input validation
- `security/sanitizers.py` - Data sanitization
- `security/rate_limiter.py` - Rate limiting
- `security/error_handler.py` - Error handling

## Environment Variables

- `GOOGLE_OAUTH_PATH`: Path to Google OAuth credentials JSON file
- `DOCUGEN_TOKEN_PATH`: (Optional) Custom token storage location
- `PYTHONPATH`: Should include the src directory

## Testing Strategy

1. **Structure Test** (with dummy credentials):
   - Verifies all imports work
   - Confirms operations are registered
   - Checks MCP handlers setup

2. **Authentication Test** (with real credentials):
   - Tests OAuth flow
   - Verifies token management
   - Confirms API connectivity

3. **Operation Test** (with Claude Desktop):
   - Tests actual operations
   - Verifies MCP protocol
   - Confirms end-to-end functionality

## Important Notes

- The server uses stdio for MCP communication
- All operations inherit from `BaseOperation` class
- Dependency injection is used for services
- Security validation happens at operation boundaries
- Errors are handled with proper MCP error responses

## For Claude AI

When modifying this codebase:
1. Maintain the modular architecture
2. Keep operations in their respective modules
3. Follow Python async best practices
4. Ensure MCP protocol compliance
5. Add proper type hints and documentation
6. Test with both dummy and real credentials
7. Update documentation for any new operations