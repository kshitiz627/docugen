# Complete Google Docs API Implementation Guide

## 1. Document Management

### Creating Documents
```javascript
// Simple creation
const doc = await docs.documents.create({
  requestBody: {
    title: 'My Document'
  }
});

// With initial content (use batchUpdate after creation)
const documentId = doc.data.documentId;
```

### Reading Documents
```javascript
// Basic read
const doc = await docs.documents.get({
  documentId: 'YOUR_DOC_ID'
});

// With tabs content
const doc = await docs.documents.get({
  documentId: 'YOUR_DOC_ID',
  includeTabsContent: true
});

// With field masks (optimized)
const doc = await docs.documents.get({
  documentId: 'YOUR_DOC_ID',
  fields: 'title,tabs(documentTab(body.content(paragraph)))'
});

// With suggestions view
const doc = await docs.documents.get({
  documentId: 'YOUR_DOC_ID',
  suggestionsViewMode: 'PREVIEW_WITH_ACCEPTED_SUGGESTIONS'
});
```

## 2. Tabs Management

### Working with Tabs
```javascript
// Access all tabs
function getAllTabs(document) {
  const allTabs = [];
  
  function traverseTabs(tabs) {
    for (const tab of tabs) {
      allTabs.push(tab);
      if (tab.childTabs) {
        traverseTabs(tab.childTabs);
      }
    }
  }
  
  if (document.tabs) {
    traverseTabs(document.tabs);
  }
  return allTabs;
}

// Target specific tab in updates
const requests = [{
  insertText: {
    location: {
      index: 1,
      tabId: 'TAB_ID'
    },
    text: 'Hello World'
  }
}];
```

## 3. Text Operations

### Insert Text (Multiple locations, work backwards!)
```javascript
const requests = [
  {
    insertText: {
      location: { index: 100, tabId: 'TAB_ID' },
      text: 'Text at position 100'
    }
  },
  {
    insertText: {
      location: { index: 50, tabId: 'TAB_ID' },
      text: 'Text at position 50'
    }
  },
  {
    insertText: {
      location: { index: 1, tabId: 'TAB_ID' },
      text: 'Text at beginning'
    }
  }
];
// Note: Ordered from highest to lowest index!
```

### Delete Text
```javascript
const requests = [{
  deleteContentRange: {
    range: {
      startIndex: 10,
      endIndex: 20,
      tabId: 'TAB_ID'
    }
  }
}];
```

### Move Text (Extract, Delete, Insert)
```javascript
// Step 1: Get the text
const doc = await docs.documents.get({ documentId });
const textToMove = extractTextFromRange(doc, startIndex, endIndex);

// Step 2: Delete from old location and insert at new
const requests = [
  {
    insertText: {
      location: { index: newIndex, tabId: 'TAB_ID' },
      text: textToMove
    }
  },
  {
    deleteContentRange: {
      range: {
        startIndex: oldStartIndex,
        endIndex: oldEndIndex,
        tabId: 'TAB_ID'
      }
    }
  }
];
// Note: Insert at higher index first if newIndex > oldStartIndex
```

### Replace All Text
```javascript
const requests = [{
  replaceAllText: {
    containsText: {
      text: 'old text',
      matchCase: true
    },
    replaceText: 'new text'
  }
}];
```

## 4. Formatting

### Character Formatting
```javascript
const requests = [{
  updateTextStyle: {
    range: {
      startIndex: 1,
      endIndex: 10,
      tabId: 'TAB_ID'
    },
    textStyle: {
      bold: true,
      italic: true,
      fontSize: {
        magnitude: 14,
        unit: 'PT'
      },
      foregroundColor: {
        color: {
          rgbColor: {
            red: 1.0,
            green: 0.0,
            blue: 0.0
          }
        }
      },
      link: {
        url: 'https://example.com'
      }
    },
    fields: 'bold,italic,fontSize,foregroundColor,link'
  }
}];
```

### Paragraph Formatting
```javascript
const requests = [{
  updateParagraphStyle: {
    range: {
      startIndex: 1,
      endIndex: 50,
      tabId: 'TAB_ID'
    },
    paragraphStyle: {
      namedStyleType: 'HEADING_1',
      alignment: 'CENTER',
      indentFirstLine: {
        magnitude: 36,
        unit: 'PT'
      },
      indentStart: {
        magnitude: 18,
        unit: 'PT'
      },
      spaceAbove: {
        magnitude: 12,
        unit: 'PT'
      },
      spaceBelow: {
        magnitude: 12,
        unit: 'PT'
      },
      lineSpacing: 150
    },
    fields: 'namedStyleType,alignment,indentFirstLine,indentStart,spaceAbove,spaceBelow,lineSpacing'
  }
}];
```

## 5. Lists

### Create Lists
```javascript
// Simple bullet list
const requests = [{
  createParagraphBullets: {
    range: {
      startIndex: 1,
      endIndex: 100,
      tabId: 'TAB_ID'
    },
    bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
  }
}];

// Numbered list
const requests = [{
  createParagraphBullets: {
    range: {
      startIndex: 1,
      endIndex: 100,
      tabId: 'TAB_ID'
    },
    bulletPreset: 'NUMBERED_DECIMAL_ALPHA_ROMAN'
  }
}];
```

### Nested Lists (use tabs before creating bullets)
```javascript
// First add tabs for nesting
const requests = [
  {
    insertText: {
      location: { index: 20, tabId: 'TAB_ID' },
      text: '\t'  // Tab for nesting
    }
  },
  {
    createParagraphBullets: {
      range: {
        startIndex: 1,
        endIndex: 100,
        tabId: 'TAB_ID'
      },
      bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
    }
  }
];
```

## 6. Tables

### Insert Table
```javascript
const requests = [{
  insertTable: {
    rows: 3,
    columns: 4,
    location: {
      index: 10,
      tabId: 'TAB_ID'
    }
  }
}];
```

### Populate Table Cells
```javascript
const requests = [{
  insertText: {
    location: {
      segmentId: '',  // Empty for main body
      tableCellLocation: {
        tableStartLocation: {
          index: tableStartIndex,
          tabId: 'TAB_ID'
        },
        rowIndex: 0,      // 0-based
        columnIndex: 0    // 0-based
      }
    },
    text: 'Cell content'
  }
}];
```

### Modify Table Structure
```javascript
// Add row
const requests = [{
  insertTableRow: {
    tableCellLocation: {
      tableStartLocation: {
        index: tableStartIndex,
        tabId: 'TAB_ID'
      },
      rowIndex: 1,
      columnIndex: 0
    },
    insertBelow: true
  }
}];

// Add column
const requests = [{
  insertTableColumn: {
    tableCellLocation: {
      tableStartLocation: {
        index: tableStartIndex,
        tabId: 'TAB_ID'
      },
      rowIndex: 0,
      columnIndex: 1
    },
    insertRight: true
  }
}];

// Merge cells
const requests = [{
  mergeTableCells: {
    tableRange: {
      tableCellLocation: {
        tableStartLocation: {
          index: tableStartIndex,
          tabId: 'TAB_ID'
        },
        rowIndex: 0,
        columnIndex: 0
      },
      rowSpan: 2,
      columnSpan: 2
    }
  }
}];
```

### Style Tables
```javascript
// Style cells
const requests = [{
  updateTableCellStyle: {
    tableCellStyle: {
      backgroundColor: {
        color: {
          rgbColor: {
            red: 0.9,
            green: 0.9,
            blue: 0.9
          }
        }
      }
    },
    tableRange: {
      tableCellLocation: {
        tableStartLocation: {
          index: tableStartIndex,
          tabId: 'TAB_ID'
        },
        rowIndex: 0,
        columnIndex: 0
      },
      rowSpan: 1,
      columnSpan: 1
    },
    fields: 'backgroundColor'
  }
}];

// Pin header rows
const requests = [{
  pinTableHeaderRows: {
    tableStartLocation: {
      index: tableStartIndex,
      tabId: 'TAB_ID'
    },
    pinnedHeaderRowsCount: 1
  }
}];
```

## 7. Images

### Insert Inline Image
```javascript
const requests = [{
  insertInlineImage: {
    uri: 'https://example.com/image.png',
    location: {
      index: 10,
      tabId: 'TAB_ID'
    },
    objectSize: {
      height: {
        magnitude: 100,
        unit: 'PT'
      },
      width: {
        magnitude: 100,
        unit: 'PT'
      }
    }
  }
}];
```

### Replace Image
```javascript
const requests = [{
  replaceImage: {
    imageObjectId: 'IMAGE_ID',
    uri: 'https://example.com/new-image.png'
  }
}];
```

## 8. Named Ranges

### Create Named Range
```javascript
const requests = [{
  createNamedRange: {
    name: 'product_description',
    range: {
      startIndex: 10,
      endIndex: 100,
      tabId: 'TAB_ID'
    }
  }
}];
```

### Replace Named Range Content
```javascript
const requests = [{
  replaceNamedRangeContent: {
    namedRangeName: 'product_description',
    text: 'New product description text'
  }
}];
```

## 9. Headers, Footers, and Page Breaks

### Create Header/Footer
```javascript
const requests = [
  {
    createHeader: {
      type: 'DEFAULT',
      sectionBreakLocation: {
        index: 0
      }
    }
  },
  {
    insertText: {
      location: {
        segmentId: 'HEADER_ID',
        index: 0
      },
      text: 'Header Text'
    }
  }
];
```

### Insert Page Break
```javascript
const requests = [{
  insertPageBreak: {
    location: {
      index: 100,
      tabId: 'TAB_ID'
    }
  }
}];
```

## 10. Batch Update Best Practices

### Always Work Backwards!
```javascript
// CORRECT: Descending order
const requests = [
  { insertText: { location: { index: 100 }, text: 'C' } },
  { insertText: { location: { index: 50 }, text: 'B' } },
  { insertText: { location: { index: 10 }, text: 'A' } }
];

// WRONG: Ascending order (indexes will shift!)
const wrongRequests = [
  { insertText: { location: { index: 10 }, text: 'A' } },
  { insertText: { location: { index: 50 }, text: 'B' } },  // Wrong! Index shifted
  { insertText: { location: { index: 100 }, text: 'C' } } // Wrong! Index shifted
];
```

### Execute Batch Update
```javascript
const response = await docs.documents.batchUpdate({
  documentId: 'YOUR_DOC_ID',
  requestBody: {
    requests: requests,
    writeControl: {
      requiredRevisionId: 'REVISION_ID'  // Optional: for consistency
    }
  }
});
```

## 11. Performance Optimization

### Use Field Masks
```javascript
// Only get what you need
const doc = await docs.documents.get({
  documentId: 'YOUR_DOC_ID',
  fields: 'title,body.content(paragraph(elements(textRun(content))))'
});
```

### Batch Operations
```javascript
// Combine multiple operations in one call
const requests = [
  // Up to 100 operations per batch
  ...textInsertions,
  ...formatting,
  ...tableOperations
];
```

### Cache Document State
```javascript
let cachedDoc = null;
let cachedRevisionId = null;

async function getDocumentCached(documentId, forceRefresh = false) {
  if (!cachedDoc || forceRefresh) {
    cachedDoc = await docs.documents.get({ 
      documentId,
      fields: 'revisionId,body'
    });
    cachedRevisionId = cachedDoc.data.revisionId;
  }
  return cachedDoc;
}
```

## 12. Error Handling

### Rate Limiting
```javascript
async function batchUpdateWithRetry(documentId, requests, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await docs.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
    } catch (error) {
      if (error.code === 429 && attempt < maxRetries - 1) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } else {
        throw error;
      }
    }
  }
}
```

### Collaborative Editing Conflicts
```javascript
async function safeUpdate(documentId, requests) {
  // Get current revision
  const doc = await docs.documents.get({
    documentId,
    fields: 'revisionId'
  });
  
  // Update with revision control
  return await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests,
      writeControl: {
        requiredRevisionId: doc.data.revisionId
      }
    }
  });
}
```

## Key Reminders

1. **Always work backwards** (descending index order)
2. **UTF-16 encoding** - some characters count as 2 units
3. **Tabs are the new default** - always specify tabId
4. **Field masks improve performance** - only request what you need
5. **Batch operations** - up to 100 per request
6. **Rate limits** - 60 req/min per user, 300 req/min per project
7. **Images must be publicly accessible** via URL
8. **Tables use tableCellLocation** not direct indices
9. **Named ranges** automatically track position changes
10. **Collaborative editing** - use writeControl for consistency