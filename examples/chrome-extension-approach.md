# Chrome Extension Approach for Fast Google Docs Manipulation

## Why It's Faster
- Runs directly in the browser
- No network roundtrip to MCP server
- Direct DOM manipulation possible
- Can use Google Docs internal APIs

## Implementation

### 1. Manifest (manifest.json)
```json
{
  "manifest_version": 3,
  "name": "DocuGen Fast",
  "version": "1.0",
  "permissions": [
    "activeTab",
    "scripting"
  ],
  "content_scripts": [{
    "matches": ["https://docs.google.com/*"],
    "js": ["content.js"]
  }],
  "action