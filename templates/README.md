# Document Templates

This directory contains document templates for the Google Docs MCP Server.

## Template Storage Structure

```
templates/
├── standard/              # Templates that ship with the server
│   ├── product-manager/   # Product management templates
│   │   └── prd.json
│   ├── engineering/       # Engineering templates
│   │   └── tech-spec.json
│   ├── qa/               # QA/Testing templates
│   ├── delivery/         # Delivery management templates
│   └── business/         # Business analyst templates
└── README.md
```

## Personal Templates Location

Your personal templates are stored in your home directory:
- **macOS/Linux**: `~/.mcp-google-docs/templates/`
- **Windows**: `%USERPROFILE%\.mcp-google-docs\templates\`

## Template Format

Templates are JSON files with this structure:

```json
{
  "id": "unique-template-id",
  "name": "Display Name",
  "description": "What this template is for",
  "category": "product-manager",
  "version": "1.0",
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
      "content": "Content with {{placeholders}}"
    },
    {
      "type": "bullet_list",
      "items": ["Item 1", "Item 2"]
    },
    {
      "type": "table",
      "rows": [
        ["Header 1", "Header 2"],
        ["Data 1", "Data 2"]
      ]
    }
  ]
}
```

## Section Types

- `heading` - With levels 1-6
- `paragraph` - Regular text content
- `bullet_list` - Unordered list
- `numbered_list` - Ordered list
- `table` - Data tables
- `page_break` - Page separator

## Placeholders

Use `{{placeholder_name}}` in your content. Common placeholders:
- `{{title}}` - Document title
- `{{date}}` - Current date
- `{{author}}` - Document author
- `{{company}}` - Company name
- `{{version}}` - Version number

## How Templates Work

1. **Standard Templates**: Pre-built templates that ship with the server
2. **Personal Templates**: Your custom templates stored locally
3. **Priority**: Personal templates can override standard ones if they use the same ID

## Creating Custom Templates

### Method 1: Use the MCP Tools
```
"Save a personal template with ID 'my-template' for weekly reports"
```

### Method 2: Clone and Modify
```
"Clone the prd template as 'my-prd' and customize it"
```

### Method 3: Create JSON File Manually
1. Create a `.json` file in your personal templates folder
2. Follow the template format above
3. Restart the MCP server

## Using Templates

```
"Create a document using the prd template with title 'New Feature PRD'"
```

## Sharing Templates

To share a template with your team:
1. Export the JSON file from your personal templates folder
2. Share the file with teammates
3. They can import it to their personal templates folder

## Template Categories

- `product-manager` - PRDs, roadmaps, feature specs
- `engineering` - Tech specs, architecture docs
- `qa` - Test plans, bug reports
- `delivery` - Release notes, status reports
- `business` - Business cases, requirements
- `personal` - Your custom templates