# VS Code Extension for Fast Execution

## Approach
Instead of MCP server roundtrips, generate executable code blocks:

```typescript
// Claude generates this code block
async function createDocument() {
  const doc = await docs.documents.create({
    title: 'Sales Report'
  });
  
  // Batch ALL operations
  const requests = [
    // ... all operations
  ];
  
  await docs.documents.batchUpdate({
    documentId: doc.documentId,
    requestBody: { requests }
  });
}

// VS Code extension provides "Run" CodeLens
// Click to execute immediately
```

## Benefits
- No MCP overhead
- Direct API calls
- Instant execution
- Code is visible and editable