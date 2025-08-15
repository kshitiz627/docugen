# DocuGen MCP Server

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org)
[![npm version](https://img.shields.io/npm/v/docugen-mcp.svg)](https://www.npmjs.com/package/docugen-mcp)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)
[![Google APIs](https://img.shields.io/badge/Google%20APIs-Docs%20%26%20Drive-4285F4)](https://developers.google.com/docs/api)

**Complete Google Docs automation for AI assistants. All 33 batch operations + tabs, suggestions, and analysis tools. 43+ operations total.**

## Features

Complete implementation with clean architecture:

- ✅ **All 33 Batch Operations** - Every single Google Docs API batch operation
- ✅ **Tab Management** - Full support for document tabs and nested tabs  
- ✅ **Suggestions API** - Create and manage suggested changes
- ✅ **Document Analysis** - Extract structure, metrics, and content
- ✅ **Complete Table Operations** - Insert/delete rows/columns, merge/unmerge cells
- ✅ **Style Management** - Document, section, and custom styles
- ✅ **Error Handling** - Exponential backoff retry logic
- ✅ **Performance Optimization** - Document caching and batch queuing
- ✅ **UTF-16 Support** - Accurate index calculations for all Unicode

## Quick Start

### Installation

```bash
# Run directly with npx
npx docugen-mcp

# Or install globally
npm install -g docugen-mcp
```

### Setup (5 minutes)

1. **Get Google Cloud Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create project, enable Docs & Drive APIs
   - Create OAuth 2.0 credentials (Desktop app)
   - Download credentials JSON

2. **Configure Your AI Assistant**:

**Claude Desktop:**
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

3. **Start Using**:
   - Restart your AI assistant
   - Test: "Create a new Google Doc"
   - Authenticate once when browser opens

## Complete Tool List (70+ Operations)

### Core Document Operations
- `create-document` - Create with initial content
- `get-document` - Retrieve with field masks  
- `delete-document` - Move to trash
- `analyze-document` - Extract structure and metrics

### Text Operations (Complete)
- `insert-text` - Insert at multiple positions
- `delete-text` - Delete content ranges
- `replace-all-text` - Find and replace
- `move-text` - Move between positions

### Formatting (Complete)
- `update-text-style` - Bold, italic, colors, fonts, links
- `update-paragraph-style` - Headings, alignment, spacing, indentation
- `update-document-style` - Document-wide styles
- `update-section-style` - Section-specific styles

### Tables (Complete)
- `insert-table` - Create with content
- `insert-table-row` - Add rows
- `insert-table-column` - Add columns
- `delete-table-row` - Remove rows
- `delete-table-column` - Remove columns
- `update-table-cell-style` - Style cells
- `update-table-row-style` - Style rows
- `update-table-column-properties` - Set widths
- `merge-table-cells` - Merge cells
- `unmerge-table-cells` - Split cells
- `pin-table-header-rows` - Fix headers

### Lists
- `create-paragraph-bullets` - Bullet/numbered/checkbox lists
- `delete-paragraph-bullets` - Remove list formatting

### Images & Objects
- `insert-inline-image` - Add from URLs
- `replace-image` - Replace existing
- `delete-positioned-object` - Remove images

### Document Structure
- `insert-page-break` - Page breaks
- `insert-section-break` - Section breaks
- `create-header` - Add headers
- `create-footer` - Add footers
- `delete-header` - Remove headers
- `delete-footer` - Remove footers
- `create-footnote` - Add footnotes

### Named Ranges
- `create-named-range` - Create ranges
- `delete-named-range` - Remove ranges
- `replace-named-range-content` - Replace content

### Tab Management (New)
- `get-tabs` - List all tabs
- `create-tab` - Create new tab
- `delete-tab` - Remove tab
- `rename-tab` - Change title
- `move-tab` - Reorder tabs
- `get-tab-content` - Get specific tab

### Suggestions API (New)
- `create-suggestion` - Create suggested edits
- `list-suggestions` - Get all suggestions
- `accept-suggestion` - Accept changes
- `reject-suggestion` - Reject changes
- `get-document-with-suggestions` - View inline

### Document Analysis (New)
- `extract-outline` - Get structure
- `get-word-count` - Statistics
- `find-all-links` - Extract links
- `find-all-images` - List images
- `find-all-tables` - List tables
- `calculate-reading-time` - Reading estimate

### High-Level Workflows
- `create-report` - Generate reports
- `create-resume` - Build resumes
- `mail-merge` - Bulk generation
- `convert-markdown` - Import markdown
- `export-markdown` - Export markdown

### Batch Operations
- `batch-update` - Execute any of 33 operations

## Usage Examples

### Complete Document Creation

```javascript
// Create document
await createDocument({
  title: "Q4 2024 Report",
  content: "Executive Summary"
});

// Add sections (auto-sorted descending)
await insertText({
  documentId: "doc123",
  insertions: [
    { index: 100, text: "Results" },
    { index: 50, text: "Achievements" },
    { index: 150, text: "Outlook" }
  ]
});

// Create data table
await insertTable({
  documentId: "doc123",
  index: 200,
  rows: 4,
  columns: 3,
  content: [
    ["Metric", "Q3", "Q4"],
    ["Revenue", "$1.2M", "$1.5M"],
    ["Users", "10K", "15K"],
    ["Growth", "20%", "25%"]
  ]
});

// Style header row
await updateTableRowStyle({
  documentId: "doc123",
  tableStartIndex: 200,
  rowIndices: [0],
  backgroundColor: "#4285f4",
  foregroundColor: "#ffffff",
  bold: true
});

// Merge cells
await mergeTableCells({
  documentId: "doc123",
  tableStartIndex: 200,
  rowIndex: 3,
  columnIndex: 0,
  rowSpan: 1,
  columnSpan: 2
});
```

### Tab Management

```javascript
// Create tabs
await createTab({
  documentId: "doc123",
  title: "Technical Specs"
});

// Add content to specific tab
await insertText({
  documentId: "doc123",
  tabId: "tab-2",
  insertions: [
    { index: 1, text: "API Endpoints" }
  ]
});
```

### Suggestions

```javascript
// Create suggestion
await createSuggestion({
  documentId: "doc123",
  suggestionId: "sug-001",
  insertText: {
    index: 50,
    text: "Needs review"
  }
});

// Accept suggestion
await acceptSuggestion({
  documentId: "doc123",
  suggestionId: "sug-001"
});
```

## Critical Implementation Details

### 1. Backward Ordering
Operations automatically sorted descending:
```javascript
// Input: [10, 50, 100]
// Executed: 100 → 50 → 10
```

### 2. Table Cell Addressing
Zero-based indices with table start:
```javascript
{
  tableCellLocation: {
    tableStartLocation: { index: 200 },
    rowIndex: 0,
    columnIndex: 1
  }
}
```

### 3. UTF-16 Encoding
Accurate character counting:
```javascript
"Hello 😀" // 8 UTF-16 units, not 7
```

### 4. Error Handling
Automatic retry with exponential backoff for rate limits.

### 5. Performance
- Document caching
- Batch queuing (up to 100)
- Field masks for efficiency

## Architecture

```
DocuGen MCP Server v4.0
├── Core Systems
│   ├── Authentication (OAuth 2.0)
│   ├── Error Handling (Exponential Backoff)
│   ├── Document Cache
│   └── Batch Queue
├── Managers
│   ├── Document Manager
│   ├── Tab Manager
│   ├── Table Manager
│   ├── Style Manager
│   ├── Suggestion Manager
│   └── Named Range Manager
├── Utilities
│   ├── UTF-16 Calculator
│   ├── Index Validator
│   ├── Field Mask Builder
│   └── Batch Optimizer
└── MCP Interface
    ├── 33 Batch Operations
    ├── Tab Operations (10+)
    ├── Suggestion Operations (8+)
    ├── Analysis Operations (10+)
    └── High-Level Workflows (5+)
```

## Why DocuGen is Production Ready

1. **Complete API Coverage** - Every Google Docs API endpoint
2. **Clean Architecture** - Single implementation, modular utilities
3. **Nothing Missing** - All 33 operations + advanced features
4. **Production Ready** - Error handling, caching, and retries
5. **Well Tested** - All operations verified and working

## For Organizations

Deploy for your entire team with one setup. Each employee maintains private access.

### IT Setup (15 minutes)
1. Create Google Cloud project
2. Enable Docs & Drive APIs
3. Create OAuth credentials
4. Share configuration with team

### Employee Setup (2 minutes)
1. Add configuration to AI assistant
2. Restart assistant
3. Authenticate once
4. Start creating documents

## Support

- GitHub Issues: [github.com/eagleisbatman/docugen/issues](https://github.com/eagleisbatman/docugen/issues)
- Documentation: [Google Docs API](https://developers.google.com/docs/api)

## Author

**Created by Gautam Mandewalker**

📍 Cumming, Forsyth County, Georgia, USA

🔗 [GitHub](https://github.com/eagleisbatman) | [LinkedIn](https://www.linkedin.com/in/gautammandewalker/)

## License

Apache-2.0

