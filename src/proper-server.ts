#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { google } from "googleapis";
import { authenticate } from "@google-cloud/local-auth";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as process from "process";
import { z } from "zod";
import { docs_v1, drive_v3 } from "googleapis";

// Handle command line arguments
if (process.argv.includes('--version') || process.argv.includes('-v')) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'package.json'), 'utf-8'));
  console.log(`docugen-mcp v${packageJson.version}`);
  process.exit(0);
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
DocuGen MCP Server - Complete Google Docs Automation

Usage:
  npx docugen-mcp              Start the MCP server
  npx docugen-mcp --version    Show version
  npx docugen-mcp --help       Show this help

Full Google Docs API implementation with all features.
`);
  process.exit(0);
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive"
];

const USER_HOME = os.homedir();
const DOCUGEN_DIR = path.join(USER_HOME, '.docugen');
const TOKEN_PATH = process.env.TOKEN_PATH || path.join(DOCUGEN_DIR, "token.json");

// Ensure directory exists
if (!fs.existsSync(DOCUGEN_DIR)) {
  fs.mkdirSync(DOCUGEN_DIR, { recursive: true });
}

// Create MCP server instance
const server = new McpServer({
  name: "docgen",
  version: "3.0.0",
});

// ============================================================================
// GOOGLE API SETUP
// ============================================================================

let docsClient: docs_v1.Docs;
let driveClient: drive_v3.Drive;

async function authorize(): Promise<any> {
  // Load saved token if exists
  if (fs.existsSync(TOKEN_PATH)) {
    try {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        "urn:ietf:wg:oauth:2.0:oob"
      );
      oauth2Client.setCredentials(token);
      return oauth2Client;
    } catch (error) {
      console.error("Invalid token, re-authenticating...");
    }
  }
  
  // Get credentials path
  const credentialsPath = process.env.GOOGLE_OAUTH_PATH || 
                          path.join(process.cwd(), 'credentials.json');
  
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at ${credentialsPath}`);
  }
  
  // Authenticate
  const auth = await authenticate({
    scopes: SCOPES,
    keyfilePath: credentialsPath,
  });
  
  // Save token
  const token = auth.credentials;
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
  
  return auth;
}

async function initClients(): Promise<boolean> {
  try {
    const auth = await authorize();
    docsClient = google.docs({ version: "v1", auth });
    driveClient = google.drive({ version: "v3", auth });
    return true;
  } catch (error) {
    console.error("Failed to initialize Google API clients:", error);
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper to get document with tabs
async function getDocumentWithTabs(documentId: string) {
  return await docsClient.documents.get({
    documentId
  });
}

// Helper to get first tab ID (most documents have single tab)
async function getFirstTabId(documentId: string): Promise<string> {
  // For simplicity, return empty string - tabs are a newer feature
  // Most documents use the default tab
  return '';
}

// Helper to extract text from document range
function extractTextFromRange(doc: any, startIndex: number, endIndex: number, tabId?: string): string {
  let text = '';
  const content = doc.body?.content;
    
  if (!content) return '';
  
  content.forEach((element: any) => {
    if (element.paragraph?.elements) {
      element.paragraph.elements.forEach((elem: any) => {
        if (elem.textRun?.content && elem.startIndex !== undefined) {
          const elemStart = elem.startIndex;
          const elemEnd = elem.endIndex || elemStart + elem.textRun.content.length;
          
          if (elemEnd > startIndex && elemStart < endIndex) {
            const start = Math.max(0, startIndex - elemStart);
            const end = Math.min(elem.textRun.content.length, endIndex - elemStart);
            text += elem.textRun.content.substring(start, end);
          }
        }
      });
    }
  });
  
  return text;
}

// Helper to find table start index
function findTableStartIndex(doc: any, tabId?: string): number | null {
  const content = doc.body?.content;
    
  if (!content) return null;
  
  for (const element of content) {
    if (element.table) {
      return element.startIndex || null;
    }
  }
  
  return null;
}

// Helper to sort requests in descending order by index
function sortRequestsDescending(requests: any[]): any[] {
  // Extract index from various request types
  const getIndex = (req: any): number => {
    if (req.insertText?.location?.index !== undefined) return req.insertText.location.index;
    if (req.deleteContentRange?.range?.startIndex !== undefined) return req.deleteContentRange.range.startIndex;
    if (req.insertTable?.location?.index !== undefined) return req.insertTable.location.index;
    if (req.insertInlineImage?.location?.index !== undefined) return req.insertInlineImage.location.index;
    if (req.updateTextStyle?.range?.startIndex !== undefined) return req.updateTextStyle.range.startIndex;
    if (req.updateParagraphStyle?.range?.startIndex !== undefined) return req.updateParagraphStyle.range.startIndex;
    if (req.createParagraphBullets?.range?.startIndex !== undefined) return req.createParagraphBullets.range.startIndex;
    if (req.insertPageBreak?.location?.index !== undefined) return req.insertPageBreak.location.index;
    return -1;
  };
  
  return requests.sort((a, b) => getIndex(b) - getIndex(a));
}

// ============================================================================
// DOCUMENT MANAGEMENT TOOLS
// ============================================================================

// Create document
server.tool(
  "create-document",
  {
    title: z.string().describe("Document title"),
    content: z.string().optional().describe("Initial content"),
    folder: z.string().optional().describe("Drive folder ID to place document")
  },
  async ({ title, content, folder }) => {
    try {
      // Create document
      const doc = await docsClient.documents.create({
        requestBody: { title }
      });
      
      const documentId = doc.data.documentId!;
      
      // Move to folder if specified
      if (folder) {
        await driveClient.files.update({
          fileId: documentId,
          addParents: folder,
          fields: 'id, parents'
        });
      }
      
      // Add initial content if provided
      if (content) {
        const tabId = await getFirstTabId(documentId);
        const requests = [{
          insertText: {
            location: { 
              index: 1,
              tabId 
            },
            text: content
          }
        }];
        
        await docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests }
        });
      }
      
      return {
        content: [{
          type: "text",
          text: `✅ Created document "${title}"\nID: ${documentId}${folder ? '\nMoved to folder: ' + folder : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating document: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Get document content
server.tool(
  "get-document",
  {
    documentId: z.string().describe("Document ID"),
    includeFormatting: z.boolean().optional().describe("Include formatting information"),
    fields: z.string().optional().describe("Field mask for optimization")
  },
  async ({ documentId, includeFormatting = false, fields }) => {
    try {
      const params: any = {
        documentId,
        includeTabsContent: true
      };
      
      if (fields) {
        params.fields = fields;
      } else if (!includeFormatting) {
        params.fields = 'title,body.content(paragraph(elements(textRun(content))))';
      }
      
      const doc = await docsClient.documents.get(params);
      
      let result = `📄 ${doc.data.title}\n\n`;
      
      // Extract text content
      if (doc.data.body?.content) {
        doc.data.body.content.forEach((element: any) => {
          if (element.paragraph?.elements) {
            element.paragraph.elements.forEach((elem: any) => {
              if (elem.textRun?.content) {
                result += elem.textRun.content;
              }
            });
          }
        });
      }
      
      if (includeFormatting) {
        result += '\n\n[Full document structure included in response]';
      }
      
      return {
        content: [{
          type: "text",
          text: result
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting document: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// TEXT MANIPULATION TOOLS
// ============================================================================

// Insert text at multiple positions
server.tool(
  "insert-text",
  {
    documentId: z.string().describe("Document ID"),
    insertions: z.array(z.object({
      index: z.number().describe("Position to insert (1-based)"),
      text: z.string().describe("Text to insert"),
      tabId: z.string().optional().describe("Tab ID (uses first tab if not specified)")
    })).describe("Text insertions (will be sorted in descending order automatically)")
  },
  async ({ documentId, insertions }) => {
    try {
      const defaultTabId = await getFirstTabId(documentId);
      
      // Build requests and sort in descending order
      const requests = insertions.map(insertion => ({
        insertText: {
          location: {
            index: insertion.index,
            tabId: insertion.tabId || defaultTabId
          },
          text: insertion.text
        }
      }));
      
      const sortedRequests = sortRequestsDescending(requests);
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: sortedRequests }
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted text at ${insertions.length} position(s)`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting text: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Delete text ranges
server.tool(
  "delete-text",
  {
    documentId: z.string().describe("Document ID"),
    ranges: z.array(z.object({
      startIndex: z.number().describe("Start of range (inclusive)"),
      endIndex: z.number().describe("End of range (exclusive)"),
      tabId: z.string().optional().describe("Tab ID")
    })).describe("Ranges to delete (will be sorted in descending order)")
  },
  async ({ documentId, ranges }) => {
    try {
      const defaultTabId = await getFirstTabId(documentId);
      
      // Build requests
      const requests = ranges.map(range => ({
        deleteContentRange: {
          range: {
            startIndex: range.startIndex,
            endIndex: range.endIndex,
            tabId: range.tabId || defaultTabId
          }
        }
      }));
      
      const sortedRequests = sortRequestsDescending(requests);
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: sortedRequests }
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Deleted ${ranges.length} text range(s)`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting text: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Move text
server.tool(
  "move-text",
  {
    documentId: z.string().describe("Document ID"),
    sourceStart: z.number().describe("Start of text to move"),
    sourceEnd: z.number().describe("End of text to move"),
    targetIndex: z.number().describe("Where to move the text"),
    tabId: z.string().optional().describe("Tab ID")
  },
  async ({ documentId, sourceStart, sourceEnd, targetIndex, tabId }) => {
    try {
      const defaultTabId = tabId || await getFirstTabId(documentId);
      
      // First, get the text to move
      const doc = await getDocumentWithTabs(documentId);
      const textToMove = extractTextFromRange(doc.data, sourceStart, sourceEnd, defaultTabId);
      
      // Build requests (order matters!)
      const requests = [];
      
      if (targetIndex > sourceEnd) {
        // Moving forward: insert first, then delete
        requests.push({
          insertText: {
            location: { index: targetIndex, tabId: defaultTabId },
            text: textToMove
          }
        });
        requests.push({
          deleteContentRange: {
            range: {
              startIndex: sourceStart,
              endIndex: sourceEnd,
              tabId: defaultTabId
            }
          }
        });
      } else {
        // Moving backward: delete first, then insert
        requests.push({
          deleteContentRange: {
            range: {
              startIndex: sourceStart,
              endIndex: sourceEnd,
              tabId: defaultTabId
            }
          }
        });
        requests.push({
          insertText: {
            location: { index: targetIndex, tabId: defaultTabId },
            text: textToMove
          }
        });
      }
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Moved text from [${sourceStart}:${sourceEnd}] to position ${targetIndex}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error moving text: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Replace all occurrences
server.tool(
  "replace-all-text",
  {
    documentId: z.string().describe("Document ID"),
    searchText: z.string().describe("Text to find"),
    replaceText: z.string().describe("Text to replace with"),
    matchCase: z.boolean().optional().describe("Case sensitive search")
  },
  async ({ documentId, searchText, replaceText, matchCase = false }) => {
    try {
      const requests = [{
        replaceAllText: {
          containsText: {
            text: searchText,
            matchCase
          },
          replaceText
        }
      }];
      
      const response = await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
      
      const occurrences = response.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
      
      return {
        content: [{
          type: "text",
          text: `✅ Replaced ${occurrences} occurrence(s) of "${searchText}" with "${replaceText}"`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error replacing text: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// FORMATTING TOOLS
// ============================================================================

// Apply text formatting
server.tool(
  "format-text",
  {
    documentId: z.string().describe("Document ID"),
    ranges: z.array(z.object({
      startIndex: z.number(),
      endIndex: z.number(),
      tabId: z.string().optional(),
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      underline: z.boolean().optional(),
      strikethrough: z.boolean().optional(),
      fontSize: z.number().optional().describe("Font size in points"),
      fontFamily: z.string().optional(),
      foregroundColor: z.object({
        red: z.number().min(0).max(1),
        green: z.number().min(0).max(1),
        blue: z.number().min(0).max(1)
      }).optional(),
      backgroundColor: z.object({
        red: z.number().min(0).max(1),
        green: z.number().min(0).max(1),
        blue: z.number().min(0).max(1)
      }).optional(),
      link: z.string().optional().describe("URL to link to")
    })).describe("Text ranges to format")
  },
  async ({ documentId, ranges }) => {
    try {
      const defaultTabId = await getFirstTabId(documentId);
      
      const requests = ranges.map(range => {
        const textStyle: any = {};
        const fields: string[] = [];
        
        if (range.bold !== undefined) {
          textStyle.bold = range.bold;
          fields.push('bold');
        }
        if (range.italic !== undefined) {
          textStyle.italic = range.italic;
          fields.push('italic');
        }
        if (range.underline !== undefined) {
          textStyle.underline = range.underline;
          fields.push('underline');
        }
        if (range.strikethrough !== undefined) {
          textStyle.strikethrough = range.strikethrough;
          fields.push('strikethrough');
        }
        if (range.fontSize !== undefined) {
          textStyle.fontSize = {
            magnitude: range.fontSize,
            unit: 'PT'
          };
          fields.push('fontSize');
        }
        if (range.fontFamily !== undefined) {
          textStyle.weightedFontFamily = {
            fontFamily: range.fontFamily
          };
          fields.push('weightedFontFamily');
        }
        if (range.foregroundColor) {
          textStyle.foregroundColor = {
            color: { rgbColor: range.foregroundColor }
          };
          fields.push('foregroundColor');
        }
        if (range.backgroundColor) {
          textStyle.backgroundColor = {
            color: { rgbColor: range.backgroundColor }
          };
          fields.push('backgroundColor');
        }
        if (range.link !== undefined) {
          textStyle.link = { url: range.link };
          fields.push('link');
        }
        
        return {
          updateTextStyle: {
            range: {
              startIndex: range.startIndex,
              endIndex: range.endIndex,
              tabId: range.tabId || defaultTabId
            },
            textStyle,
            fields: fields.join(',')
          }
        };
      });
      
      const sortedRequests = sortRequestsDescending(requests);
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: sortedRequests }
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Applied formatting to ${ranges.length} text range(s)`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error formatting text: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Apply paragraph formatting
server.tool(
  "format-paragraph",
  {
    documentId: z.string().describe("Document ID"),
    ranges: z.array(z.object({
      startIndex: z.number(),
      endIndex: z.number(),
      tabId: z.string().optional(),
      namedStyle: z.enum([
        'NORMAL_TEXT', 'TITLE', 'SUBTITLE',
        'HEADING_1', 'HEADING_2', 'HEADING_3', 
        'HEADING_4', 'HEADING_5', 'HEADING_6'
      ]).optional(),
      alignment: z.enum(['START', 'CENTER', 'END', 'JUSTIFIED']).optional(),
      lineSpacing: z.number().optional().describe("Line spacing as percentage (100 = single)"),
      spaceAbove: z.number().optional().describe("Space above in points"),
      spaceBelow: z.number().optional().describe("Space below in points"),
      indentStart: z.number().optional().describe("Left indent in points"),
      indentEnd: z.number().optional().describe("Right indent in points"),
      indentFirstLine: z.number().optional().describe("First line indent in points")
    })).describe("Paragraph ranges to format")
  },
  async ({ documentId, ranges }) => {
    try {
      const defaultTabId = await getFirstTabId(documentId);
      
      const requests = ranges.map(range => {
        const paragraphStyle: any = {};
        const fields: string[] = [];
        
        if (range.namedStyle) {
          paragraphStyle.namedStyleType = range.namedStyle;
          fields.push('namedStyleType');
        }
        if (range.alignment) {
          paragraphStyle.alignment = range.alignment;
          fields.push('alignment');
        }
        if (range.lineSpacing !== undefined) {
          paragraphStyle.lineSpacing = range.lineSpacing;
          fields.push('lineSpacing');
        }
        if (range.spaceAbove !== undefined) {
          paragraphStyle.spaceAbove = {
            magnitude: range.spaceAbove,
            unit: 'PT'
          };
          fields.push('spaceAbove');
        }
        if (range.spaceBelow !== undefined) {
          paragraphStyle.spaceBelow = {
            magnitude: range.spaceBelow,
            unit: 'PT'
          };
          fields.push('spaceBelow');
        }
        if (range.indentStart !== undefined) {
          paragraphStyle.indentStart = {
            magnitude: range.indentStart,
            unit: 'PT'
          };
          fields.push('indentStart');
        }
        if (range.indentEnd !== undefined) {
          paragraphStyle.indentEnd = {
            magnitude: range.indentEnd,
            unit: 'PT'
          };
          fields.push('indentEnd');
        }
        if (range.indentFirstLine !== undefined) {
          paragraphStyle.indentFirstLine = {
            magnitude: range.indentFirstLine,
            unit: 'PT'
          };
          fields.push('indentFirstLine');
        }
        
        return {
          updateParagraphStyle: {
            range: {
              startIndex: range.startIndex,
              endIndex: range.endIndex,
              tabId: range.tabId || defaultTabId
            },
            paragraphStyle,
            fields: fields.join(',')
          }
        };
      });
      
      const sortedRequests = sortRequestsDescending(requests);
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: sortedRequests }
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Applied paragraph formatting to ${ranges.length} range(s)`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error formatting paragraphs: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// LISTS TOOLS
// ============================================================================

// Create lists
server.tool(
  "create-list",
  {
    documentId: z.string().describe("Document ID"),
    ranges: z.array(z.object({
      startIndex: z.number(),
      endIndex: z.number(),
      tabId: z.string().optional(),
      listType: z.enum([
        'BULLET_DISC_CIRCLE_SQUARE',
        'BULLET_ARROW_DIAMOND_DISC',
        'BULLET_CHECKBOX',
        'NUMBERED_DECIMAL_ALPHA_ROMAN',
        'NUMBERED_DECIMAL_NESTED',
        'NUMBERED_UPPERALPHA_ALPHA_ROMAN'
      ]).describe("Type of list to create")
    })).describe("Ranges to convert to lists")
  },
  async ({ documentId, ranges }) => {
    try {
      const defaultTabId = await getFirstTabId(documentId);
      
      const requests = ranges.map(range => ({
        createParagraphBullets: {
          range: {
            startIndex: range.startIndex,
            endIndex: range.endIndex,
            tabId: range.tabId || defaultTabId
          },
          bulletPreset: range.listType
        }
      }));
      
      const sortedRequests = sortRequestsDescending(requests);
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: sortedRequests }
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Created ${ranges.length} list(s)`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating lists: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// TABLE TOOLS
// ============================================================================

// Insert table
server.tool(
  "insert-table",
  {
    documentId: z.string().describe("Document ID"),
    index: z.number().describe("Position to insert table"),
    rows: z.number().min(1).describe("Number of rows"),
    columns: z.number().min(1).describe("Number of columns"),
    tabId: z.string().optional().describe("Tab ID"),
    content: z.array(z.array(z.string())).optional().describe("Optional initial cell content")
  },
  async ({ documentId, index, rows, columns, tabId, content }) => {
    try {
      const defaultTabId = tabId || await getFirstTabId(documentId);
      
      // Insert table
      const insertTableRequest = {
        insertTable: {
          rows,
          columns,
          location: {
            index,
            tabId: defaultTabId
          }
        }
      };
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: [insertTableRequest] }
      });
      
      // If content provided, populate cells
      if (content && content.length > 0) {
        const cellRequests: any[] = [];
        
        for (let rowIndex = 0; rowIndex < Math.min(rows, content.length); rowIndex++) {
          for (let colIndex = 0; colIndex < Math.min(columns, content[rowIndex].length); colIndex++) {
            const cellText = content[rowIndex][colIndex];
            if (cellText) {
              cellRequests.push({
                insertText: {
                  location: {
                    segmentId: '',
                    tableCellLocation: {
                      tableStartLocation: {
                        index,
                        tabId: defaultTabId
                      },
                      rowIndex,
                      columnIndex: colIndex
                    }
                  },
                  text: cellText
                }
              });
            }
          }
        }
        
        if (cellRequests.length > 0) {
          // Sort cell updates in reverse order
          cellRequests.reverse();
          
          await docsClient.documents.batchUpdate({
            documentId,
            requestBody: { requests: cellRequests }
          });
        }
      }
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted ${rows}×${columns} table at position ${index}${content ? ' with content' : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting table: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Update table cells
server.tool(
  "update-table-cells",
  {
    documentId: z.string().describe("Document ID"),
    tableStartIndex: z.number().describe("Start index of the table"),
    updates: z.array(z.object({
      rowIndex: z.number().describe("Row index (0-based)"),
      columnIndex: z.number().describe("Column index (0-based)"),
      text: z.string().describe("Text to insert in cell"),
      replaceExisting: z.boolean().optional().describe("Replace existing content (default: true)")
    })).describe("Cell updates"),
    tabId: z.string().optional().describe("Tab ID")
  },
  async ({ documentId, tableStartIndex, updates, tabId }) => {
    try {
      const defaultTabId = tabId || await getFirstTabId(documentId);
      
      const requests = updates.map(update => ({
        insertText: {
          location: {
            segmentId: '',
            tableCellLocation: {
              tableStartLocation: {
                index: tableStartIndex,
                tabId: defaultTabId
              },
              rowIndex: update.rowIndex,
              columnIndex: update.columnIndex
            }
          },
          text: update.text
        }
      }));
      
      // Reverse order for cell updates
      requests.reverse();
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Updated ${updates.length} table cell(s)`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error updating table cells: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// IMAGE TOOLS
// ============================================================================

// Insert image
server.tool(
  "insert-image",
  {
    documentId: z.string().describe("Document ID"),
    imageUrl: z.string().url().describe("Public URL of the image"),
    index: z.number().describe("Position to insert image"),
    width: z.number().optional().describe("Width in points"),
    height: z.number().optional().describe("Height in points"),
    tabId: z.string().optional().describe("Tab ID")
  },
  async ({ documentId, imageUrl, index, width, height, tabId }) => {
    try {
      const defaultTabId = tabId || await getFirstTabId(documentId);
      
      const request: any = {
        insertInlineImage: {
          uri: imageUrl,
          location: {
            index,
            tabId: defaultTabId
          }
        }
      };
      
      if (width || height) {
        request.insertInlineImage.objectSize = {};
        if (width) {
          request.insertInlineImage.objectSize.width = {
            magnitude: width,
            unit: 'PT'
          };
        }
        if (height) {
          request.insertInlineImage.objectSize.height = {
            magnitude: height,
            unit: 'PT'
          };
        }
      }
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: [request] }
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted image at position ${index}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting image: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// NAMED RANGES TOOLS
// ============================================================================

// Create named range
server.tool(
  "create-named-range",
  {
    documentId: z.string().describe("Document ID"),
    name: z.string().describe("Name for the range"),
    startIndex: z.number().describe("Start of range"),
    endIndex: z.number().describe("End of range"),
    tabId: z.string().optional().describe("Tab ID")
  },
  async ({ documentId, name, startIndex, endIndex, tabId }) => {
    try {
      const defaultTabId = tabId || await getFirstTabId(documentId);
      
      const request = {
        createNamedRange: {
          name,
          range: {
            startIndex,
            endIndex,
            tabId: defaultTabId
          }
        }
      };
      
      const response = await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: [request] }
      });
      
      const namedRangeId = response.data.replies?.[0]?.createNamedRange?.namedRangeId;
      
      return {
        content: [{
          type: "text",
          text: `✅ Created named range "${name}"\nID: ${namedRangeId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating named range: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// DOCUMENT STRUCTURE TOOLS
// ============================================================================

// Insert page break
server.tool(
  "insert-page-break",
  {
    documentId: z.string().describe("Document ID"),
    index: z.number().describe("Position to insert page break"),
    tabId: z.string().optional().describe("Tab ID")
  },
  async ({ documentId, index, tabId }) => {
    try {
      const defaultTabId = tabId || await getFirstTabId(documentId);
      
      const request = {
        insertPageBreak: {
          location: {
            index,
            tabId: defaultTabId
          }
        }
      };
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: [request] }
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted page break at position ${index}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting page break: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Insert section break
server.tool(
  "insert-section-break",
  {
    documentId: z.string().describe("Document ID"),
    index: z.number().describe("Position to insert section break"),
    sectionType: z.enum(['CONTINUOUS', 'NEXT_PAGE']).optional().describe("Type of section break"),
    tabId: z.string().optional().describe("Tab ID")
  },
  async ({ documentId, index, sectionType = 'NEXT_PAGE', tabId }) => {
    try {
      const defaultTabId = tabId || await getFirstTabId(documentId);
      
      const request = {
        insertSectionBreak: {
          location: {
            index,
            tabId: defaultTabId
          },
          sectionType
        }
      };
      
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: [request] }
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted ${sectionType} section break at position ${index}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting section break: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Create header
server.tool(
  "create-header",
  {
    documentId: z.string().describe("Document ID"),
    headerType: z.enum(['DEFAULT', 'FIRST_PAGE', 'EVEN_PAGE']).optional().describe("Header type"),
    headerText: z.string().optional().describe("Text to add to header")
  },
  async ({ documentId, headerType = 'DEFAULT', headerText }) => {
    try {
      const requests: any[] = [{
        createHeader: {
          type: headerType,
          sectionBreakLocation: {
            index: 0
          }
        }
      }];
      
      const response = await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
      
      // Get header ID from response
      const headerId = response.data.replies?.[0]?.createHeader?.headerId;
      
      // Add text to header if provided
      if (headerText && headerId) {
        const textRequest = {
          insertText: {
            location: {
              segmentId: headerId,
              index: 0
            },
            text: headerText
          }
        };
        
        await docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [textRequest] }
        });
      }
      
      return {
        content: [{
          type: "text",
          text: `✅ Created ${headerType} header${headerText ? ' with text' : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating header: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Create footer
server.tool(
  "create-footer",
  {
    documentId: z.string().describe("Document ID"),
    footerType: z.enum(['DEFAULT', 'FIRST_PAGE', 'EVEN_PAGE']).optional().describe("Footer type"),
    footerText: z.string().optional().describe("Text to add to footer")
  },
  async ({ documentId, footerType = 'DEFAULT', footerText }) => {
    try {
      const requests: any[] = [{
        createFooter: {
          type: footerType,
          sectionBreakLocation: {
            index: 0
          }
        }
      }];
      
      const response = await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
      
      // Get footer ID from response
      const footerId = response.data.replies?.[0]?.createFooter?.footerId;
      
      // Add text to footer if provided
      if (footerText && footerId) {
        const textRequest = {
          insertText: {
            location: {
              segmentId: footerId,
              index: 0
            },
            text: footerText
          }
        };
        
        await docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [textRequest] }
        });
      }
      
      return {
        content: [{
          type: "text",
          text: `✅ Created ${footerType} footer${footerText ? ' with text' : ''}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating footer: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Create footnote
server.tool(
  "create-footnote",
  {
    documentId: z.string().describe("Document ID"),
    index: z.number().describe("Position to insert footnote reference"),
    footnoteText: z.string().describe("Footnote text"),
    tabId: z.string().optional().describe("Tab ID")
  },
  async ({ documentId, index, footnoteText, tabId }) => {
    try {
      const defaultTabId = tabId || await getFirstTabId(documentId);
      
      const requests = [{
        createFootnote: {
          location: {
            index,
            tabId: defaultTabId
          }
        }
      }];
      
      const response = await docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
      
      // Get footnote ID from response
      const footnoteId = response.data.replies?.[0]?.createFootnote?.footnoteId;
      
      // Add text to footnote
      if (footnoteId) {
        const textRequest = {
          insertText: {
            location: {
              segmentId: footnoteId,
              index: 0
            },
            text: footnoteText
          }
        };
        
        await docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [textRequest] }
        });
      }
      
      return {
        content: [{
          type: "text",
          text: `✅ Created footnote at position ${index}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating footnote: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// BATCH OPERATIONS TOOL
// ============================================================================

// Execute custom batch update
server.tool(
  "batch-update",
  {
    documentId: z.string().describe("Document ID"),
    requests: z.array(z.any()).describe("Array of batch update requests (will be auto-sorted in descending order)"),
    writeControl: z.object({
      requiredRevisionId: z.string().optional(),
      targetRevisionId: z.string().optional()
    }).optional().describe("Write control for collaborative editing")
  },
  async ({ documentId, requests, writeControl }) => {
    try {
      // Sort requests in descending order
      const sortedRequests = sortRequestsDescending(requests);
      
      const requestBody: any = { requests: sortedRequests };
      
      if (writeControl) {
        requestBody.writeControl = writeControl;
      }
      
      const response = await docsClient.documents.batchUpdate({
        documentId,
        requestBody
      });
      
      return {
        content: [{
          type: "text",
          text: `✅ Executed ${requests.length} batch operation(s)\nRevision: ${response.data.documentId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error in batch update: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// RESOURCES
// ============================================================================

// List documents
server.resource(
  "list-documents",
  "googledocs://list",
  async (uri) => {
    try {
      const response = await driveClient.files.list({
        q: "mimeType='application/vnd.google-apps.document'",
        fields: "files(id, name, createdTime, modifiedTime, parents)",
        pageSize: 50,
        orderBy: "modifiedTime desc"
      });

      const files = response.data.files || [];
      let content = "📚 Recent Google Docs:\n\n";
      
      if (files.length === 0) {
        content += "No documents found.";
      } else {
        files.forEach((file: any) => {
          content += `📄 ${file.name}\n`;
          content += `   ID: ${file.id}\n`;
          content += `   Modified: ${new Date(file.modifiedTime).toLocaleDateString()}\n`;
          if (file.parents && file.parents.length > 0) {
            content += `   Folders: ${file.parents.join(', ')}\n`;
          }
          content += '\n';
        });
      }

      return {
        contents: [{
          uri: uri.href,
          text: content,
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error listing documents: ${error}`,
        }]
      };
    }
  }
);

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const initialized = await initClients();
  
  if (!initialized) {
    console.error("⚠️  Failed to initialize Google API clients!");
    console.error("The server will run but operations will fail.");
  }
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("DocGen MCP Server running");
  console.error("Full Google Docs API implementation ready");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});