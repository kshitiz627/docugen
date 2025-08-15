# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

- **Build TypeScript**: `npm run build` - Compiles TypeScript from src/ to build/
- **Development mode**: `npm run dev` - Runs TypeScript compiler in watch mode  
- **Start server**: `npm start` - Runs the compiled MCP server from build/server.js

## Architecture Overview

DocuGen is an MCP (Model Context Protocol) server that enables AI assistants to create and manage Google Docs with professional formatting and templates.

### Core Components

1. **MCP Server** (`src/server.ts`): Main server implementing the Model Context Protocol
   - Handles tool registration and request routing
   - Uses StdioServerTransport for communication with Claude Desktop

2. **Google APIs Integration**: 
   - OAuth2 authentication with Google (credentials.json/token.json)
   - Google Docs API for document creation and formatting
   - Google Drive API for listing and searching documents

3. **Template System** (`TemplateManager` class):
   - Standard templates in `templates/standard/` (shipped with server)
   - User templates in `~/.docgen/templates/` (customizable)
   - Templates use placeholder syntax: `{{variable}}`
   - Supports complex formatting (headings, tables, lists, styles)

### Key Features

- **Document Operations**: create, update, list, search, delete Google Docs
- **Advanced Formatting**: Apply text styles, create tables, lists, headings
- **Template Management**: Apply built-in templates, create/save/clone custom templates
- **MCP Resources**: Read-only access to document lists via resource URIs

### Authentication Flow

1. First run: Opens browser for Google OAuth consent
2. Saves refresh token to `token.json` for future use
3. Supports custom credentials or environment variables (GOOGLE_CLIENT_ID/SECRET)

### Template Structure

Templates are JSON files with sections array containing:
- `type`: heading, paragraph, bullet_list, numbered_list, table
- `content`: Text with `{{placeholders}}`
- `style`: Formatting options (bold, italic, fontSize, color, alignment)
- `level`: For headings (1-6)
- `items`: For lists
- `rows`: For tables

## Important Notes

- TypeScript is configured with loose typing (`strict: false`, `noImplicitAny: false`)
- The server runs as an MCP server communicating via stdio with Claude Desktop
- User templates persist in home directory, allowing customization without modifying source
- Google API clients are initialized on server startup for performance