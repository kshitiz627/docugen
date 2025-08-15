# Google Docs API Complete Reference Index

## Core Concepts

### Document Structure
- **Document ID**: Unique identifier for each document
- **Indexes**: 1-based positions in document (UTF-16 encoded)
- **Tabs**: Documents can have multiple tabs (new feature)
- **Elements**: Body, DocumentStyle, Lists, Tables, etc.

### Index Management
- **CRITICAL**: Always work in DESCENDING order (backwards) to avoid index shifts
- Indexes change dynamically when content is added/removed
- UTF-16 encoding means some characters count as 2 units

## All Available Operations (batchUpdate)

### Text Operations
1. **InsertTextRequest** - Add text at specific index
2. **ReplaceAllTextRequest** - Find and replace throughout document
3. **DeleteContentRangeRequest** - Remove text/content
4. **UpdateTextStyleRequest** - Format text (bold, italic, etc.)

### Paragraph & Formatting
5. **UpdateParagraphStyleRequest** - Change paragraph properties
6. **CreateParagraphBulletsRequest** - Create bullet/numbered lists
7. **DeleteParagraphBulletsRequest** - Remove list formatting

### Tables
8. **InsertTableRequest** - Create new table
9. **InsertTableRowRequest** - Add rows
10. **InsertTableColumnRequest** - Add columns
11. **DeleteTableRowRequest** - Remove rows
12. **DeleteTableColumnRequest** - Remove columns
13. **UpdateTableColumnPropertiesRequest** - Modify column properties
14. **UpdateTableCellStyleRequest** - Format cells
15. **UpdateTableRowStyleRequest** - Format rows
16. **MergeTableCellsRequest** - Merge cells
17. **UnmergeTableCellsRequest** - Split merged cells
18. **PinTableHeaderRowsRequest** - Fix header rows

### Images
19. **InsertInlineImageRequest** - Add images
20. **ReplaceImageRequest** - Replace existing images
21. **DeletePositionedObjectRequest** - Remove positioned objects

### Document Structure
22. **InsertPageBreakRequest** - Add page breaks
23. **InsertSectionBreakRequest** - Add section breaks
24. **CreateHeaderRequest** - Add headers
25. **CreateFooterRequest** - Add footers
26. **DeleteHeaderRequest** - Remove headers
27. **DeleteFooterRequest** - Remove footers
28. **CreateFootnoteRequest** - Add footnotes

### Named Ranges
29. **CreateNamedRangeRequest** - Create named range
30. **DeleteNamedRangeRequest** - Remove named range
31. **ReplaceNamedRangeContentRequest** - Replace content in named range

### Styles
32. **UpdateDocumentStyleRequest** - Change document-wide styles
33. **UpdateSectionStyleRequest** - Modify section styles

## Table Index Calculation

### Table Structure
```
Table Start Index
├── Row 0
│   ├── Cell 0,0
│   ├── Cell 0,1
│   └── Cell 0,2
├── Row 1
│   ├── Cell 1,0
│   ├── Cell 1,1
│   └── Cell 1,2
```

### Cell Location
```javascript
{
  'tableCellLocation': {
    'tableStartLocation': {
      'index': tableStartIndex,  // Where table begins
      'tabId': TAB_ID
    },
    'rowIndex': 0,      // 0-based
    'columnIndex': 0    // 0-based
  }
}
```

## Best Practices

### 1. Batch Operations
- Group multiple operations in single batchUpdate
- Order requests in DESCENDING index order
- Maximum 100 requests per batch

### 2. Performance
- Use field masks to retrieve only needed data
- Cache document structure when possible
- Minimize API calls with batch operations

### 3. Error Handling
- Check for collaborative editing conflicts
- Use WriteControl for consistency
- Handle rate limiting (60 requests/minute)

### 4. Collaborative Editing
- Expect document state to change between calls
- Use revision IDs when available
- Program defensively

## Common Patterns

### Creating Formatted Document
1. Create document
2. Insert content (backwards from end)
3. Apply formatting (backwards)
4. Add tables/images at specific positions

### Working with Tables
1. Insert table at desired position
2. Populate cells using tableCellLocation
3. Format cells/rows as needed
4. Consider pinning header rows

### Safe Updates
1. Get current document state
2. Calculate all positions needed
3. Sort operations by index (descending)
4. Execute batchUpdate

## Authentication
- OAuth 2.0 required
- Scopes needed:
  - https://www.googleapis.com/auth/documents (full access)
  - https://www.googleapis.com/auth/documents.readonly (read only)
  - https://www.googleapis.com/auth/drive (for file operations)

## Rate Limits
- 60 requests per minute per user
- 300 requests per minute per project
- Use exponential backoff for retries

## Common Mistakes to Avoid
1. ❌ Working in ascending index order
2. ❌ Not accounting for UTF-16 encoding
3. ❌ Ignoring collaborative editing
4. ❌ Not using batch operations
5. ❌ Hardcoding indexes without checking document state
6. ❌ Not handling tab IDs properly
7. ❌ Assuming 1 character = 1 index unit

## Resources
- [API Reference](https://developers.google.com/docs/api/reference/rest)
- [How-to Guides](https://developers.google.com/docs/api/how-tos/overview)
- [Samples](https://developers.google.com/docs/api/samples)
- [Quickstart](https://developers.google.com/docs/api/quickstart/nodejs)