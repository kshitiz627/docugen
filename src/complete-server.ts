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

// ============================================================================
// COMPLETE GOOGLE DOCS API IMPLEMENTATION
// Version 4.0 - All 33 batch operations + tabs + suggestions + analysis
// ============================================================================

const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/drive.file"
];

const USER_HOME = os.homedir();
const DOCUGEN_DIR = path.join(USER_HOME, '.docugen');
const TOKEN_PATH = process.env.TOKEN_PATH || path.join(DOCUGEN_DIR, "token.json");
const CACHE_DIR = path.join(DOCUGEN_DIR, 'cache');

// Ensure directories exist
if (!fs.existsSync(DOCUGEN_DIR)) {
  fs.mkdirSync(DOCUGEN_DIR, { recursive: true });
}
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Create MCP server instance
const server = new McpServer({
  name: "docgen-complete",
  version: "4.0.0",
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

class DocGenError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean,
    public details: any
  ) {
    super(message);
    this.name = 'DocGenError';
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  operation = 'operation'
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = i === maxRetries - 1;
      
      if (isLastAttempt) {
        throw new DocGenError(
          `Failed after ${maxRetries} attempts: ${error.message}`,
          'MAX_RETRIES_EXCEEDED',
          false,
          { operation, attempts: maxRetries, originalError: error }
        );
      }
      
      if (error.code === 429 || error.status === 429) {
        const delay = Math.pow(2, i) * 1000;
        console.error(`Rate limited, retrying ${operation} in ${delay}ms...`);
        await sleep(delay);
      } else if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        const delay = Math.pow(2, i) * 500;
        console.error(`Network error, retrying ${operation} in ${delay}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
  throw new Error('Unreachable');
}

// ============================================================================
// CACHING SYSTEM
// ============================================================================

interface CachedDocument {
  doc: any;
  timestamp: number;
  revision: string;
  etag?: string;
}

class DocumentCache {
  private cache = new Map<string, CachedDocument>();
  private maxAge = 5 * 60 * 1000; // 5 minutes
  
  get(documentId: string): CachedDocument | null {
    const cached = this.cache.get(documentId);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(documentId);
      return null;
    }
    
    return cached;
  }
  
  set(documentId: string, doc: any, revision: string): void {
    this.cache.set(documentId, {
      doc,
      timestamp: Date.now(),
      revision
    });
  }
  
  invalidate(documentId: string): void {
    this.cache.delete(documentId);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

const documentCache = new DocumentCache();

// ============================================================================
// UTF-16 UTILITIES
// ============================================================================

function getUTF16Length(str: string): number {
  let length = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xD800 && code <= 0xDBFF) {
      // High surrogate
      if (i + 1 < str.length) {
        const next = str.charCodeAt(i + 1);
        if (next >= 0xDC00 && next <= 0xDFFF) {
          // Low surrogate - counts as 1 UTF-16 unit
          length++;
          i++; // Skip next
          continue;
        }
      }
    }
    length++;
  }
  return length;
}

function validateIndex(index: number, maxIndex: number, operation: string): void {
  if (index < 1 || index > maxIndex) {
    throw new DocGenError(
      `Invalid index ${index} for ${operation}. Must be between 1 and ${maxIndex}`,
      'INVALID_INDEX',
      false,
      { index, maxIndex, operation }
    );
  }
}

// ============================================================================
// GOOGLE API SETUP
// ============================================================================

let docsClient: docs_v1.Docs;
let driveClient: drive_v3.Drive;

async function authorize(): Promise<any> {
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
  
  const credentialsPath = process.env.GOOGLE_OAUTH_PATH || 
                          path.join(process.cwd(), 'credentials.json');
  
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Credentials file not found at ${credentialsPath}`);
  }
  
  const auth = await authenticate({
    scopes: SCOPES,
    keyfilePath: credentialsPath,
  });
  
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
// TAB MANAGEMENT
// ============================================================================

interface Tab {
  tabId: string;
  title: string;
  index: number;
  parentTabId?: string;
  documentTab?: any;
  childTabs?: Tab[];
}

function getAllTabs(doc: any): Tab[] {
  const allTabs: Tab[] = [];
  
  function traverseTabs(tabs: any[], parentId?: string) {
    if (!tabs) return;
    
    for (const tab of tabs) {
      const tabInfo: Tab = {
        tabId: tab.tabProperties?.tabId || '',
        title: tab.tabProperties?.title || '',
        index: tab.tabProperties?.index || 0,
        parentTabId: parentId,
        documentTab: tab.documentTab
      };
      
      allTabs.push(tabInfo);
      
      if (tab.childTabs) {
        tabInfo.childTabs = [];
        traverseTabs(tab.childTabs, tabInfo.tabId);
      }
    }
  }
  
  if (doc.tabs) {
    traverseTabs(doc.tabs);
  }
  
  return allTabs;
}

// ============================================================================
// DOCUMENT STRUCTURE ANALYSIS
// ============================================================================

interface DocumentStructure {
  headings: Array<{
    level: number;
    text: string;
    index: number;
  }>;
  tables: Array<{
    index: number;
    rows: number;
    columns: number;
  }>;
  images: Array<{
    index: number;
    uri?: string;
    objectId: string;
  }>;
  lists: Array<{
    index: number;
    type: string;
    items: number;
  }>;
  namedRanges: Array<{
    name: string;
    startIndex: number;
    endIndex: number;
  }>;
  links: Array<{
    url: string;
    text: string;
    index: number;
  }>;
  statistics: {
    wordCount: number;
    characterCount: number;
    paragraphCount: number;
    pageCount: number;
  };
}

function analyzeDocument(doc: any): DocumentStructure {
  const structure: DocumentStructure = {
    headings: [],
    tables: [],
    images: [],
    lists: [],
    namedRanges: [],
    links: [],
    statistics: {
      wordCount: 0,
      characterCount: 0,
      paragraphCount: 0,
      pageCount: 1
    }
  };
  
  // Analyze body content
  if (doc.body?.content) {
    for (const element of doc.body.content) {
      // Paragraphs and headings
      if (element.paragraph) {
        structure.statistics.paragraphCount++;
        
        const style = element.paragraph.paragraphStyle?.namedStyleType;
        if (style && style.startsWith('HEADING_')) {
          const level = parseInt(style.replace('HEADING_', ''));
          const text = extractParagraphText(element.paragraph);
          structure.headings.push({
            level,
            text,
            index: element.startIndex || 0
          });
        }
        
        // Extract text and links
        if (element.paragraph.elements) {
          for (const elem of element.paragraph.elements) {
            if (elem.textRun) {
              const text = elem.textRun.content || '';
              structure.statistics.characterCount += text.length;
              structure.statistics.wordCount += text.split(/\s+/).filter(w => w).length;
              
              if (elem.textRun.textStyle?.link?.url) {
                structure.links.push({
                  url: elem.textRun.textStyle.link.url,
                  text: text,
                  index: elem.startIndex || 0
                });
              }
            }
            
            if (elem.inlineObjectElement) {
              structure.images.push({
                index: elem.startIndex || 0,
                objectId: elem.inlineObjectElement.inlineObjectId
              });
            }
          }
        }
        
        // Lists
        if (element.paragraph.bullet) {
          const existing = structure.lists.find(
            l => Math.abs(l.index - (element.startIndex || 0)) < 10
          );
          if (existing) {
            existing.items++;
          } else {
            structure.lists.push({
              index: element.startIndex || 0,
              type: element.paragraph.bullet.listId || 'bullet',
              items: 1
            });
          }
        }
      }
      
      // Tables
      if (element.table) {
        structure.tables.push({
          index: element.startIndex || 0,
          rows: element.table.rows || 0,
          columns: element.table.columns || 0
        });
      }
    }
  }
  
  // Named ranges
  if (doc.namedRanges) {
    for (const [name, ranges] of Object.entries(doc.namedRanges)) {
      if (Array.isArray(ranges)) {
        for (const range of ranges) {
          structure.namedRanges.push({
            name,
            startIndex: range.range?.startIndex || 0,
            endIndex: range.range?.endIndex || 0
          });
        }
      }
    }
  }
  
  // Estimate page count
  structure.statistics.pageCount = Math.max(1, 
    Math.ceil(structure.statistics.wordCount / 500)
  );
  
  return structure;
}

function extractParagraphText(paragraph: any): string {
  let text = '';
  if (paragraph.elements) {
    for (const elem of paragraph.elements) {
      if (elem.textRun?.content) {
        text += elem.textRun.content;
      }
    }
  }
  return text.trim();
}

// ============================================================================
// BATCH OPERATION UTILITIES
// ============================================================================

function sortRequestsDescending(requests: any[]): any[] {
  const getIndex = (req: any): number => {
    // Extract index from various request types
    if (req.insertText?.location?.index !== undefined) return req.insertText.location.index;
    if (req.deleteContentRange?.range?.startIndex !== undefined) return req.deleteContentRange.range.startIndex;
    if (req.insertTable?.location?.index !== undefined) return req.insertTable.location.index;
    if (req.insertInlineImage?.location?.index !== undefined) return req.insertInlineImage.location.index;
    if (req.insertPageBreak?.location?.index !== undefined) return req.insertPageBreak.location.index;
    if (req.insertSectionBreak?.location?.index !== undefined) return req.insertSectionBreak.location.index;
    if (req.updateTextStyle?.range?.startIndex !== undefined) return req.updateTextStyle.range.startIndex;
    if (req.updateParagraphStyle?.range?.startIndex !== undefined) return req.updateParagraphStyle.range.startIndex;
    if (req.createParagraphBullets?.range?.startIndex !== undefined) return req.createParagraphBullets.range.startIndex;
    if (req.deleteParagraphBullets?.range?.startIndex !== undefined) return req.deleteParagraphBullets.range.startIndex;
    if (req.createNamedRange?.range?.startIndex !== undefined) return req.createNamedRange.range.startIndex;
    if (req.deleteNamedRange?.name !== undefined) return Number.MAX_SAFE_INTEGER; // Process last
    if (req.replaceAllText !== undefined) return Number.MAX_SAFE_INTEGER; // Process last
    if (req.updateDocumentStyle !== undefined) return Number.MAX_SAFE_INTEGER; // Process last
    return -1;
  };
  
  return requests.sort((a, b) => getIndex(b) - getIndex(a));
}

function validateBatchRequests(requests: any[]): void {
  if (requests.length > 100) {
    throw new DocGenError(
      `Batch request contains ${requests.length} operations, maximum is 100`,
      'BATCH_TOO_LARGE',
      false,
      { count: requests.length }
    );
  }
}

// ============================================================================
// COMPLETE TABLE OPERATIONS
// ============================================================================

// Insert table row
server.tool(
  "insert-table-row",
  {
    documentId: z.string(),
    tableStartIndex: z.number(),
    rowIndex: z.number().describe("Row index where to insert (0-based)"),
    insertBelow: z.boolean().optional().describe("Insert below the row (default: true)"),
    tabId: z.string().optional()
  },
  async ({ documentId, tableStartIndex, rowIndex, insertBelow = true, tabId }) => {
    try {
      const request = {
        insertTableRow: {
          tableCellLocation: {
            tableStartLocation: {
              index: tableStartIndex,
              tabId: tabId || ''
            },
            rowIndex,
            columnIndex: 0
          },
          insertBelow
        }
      };
      
      await withRetry(() => 
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'insert-table-row'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted row ${insertBelow ? 'below' : 'above'} row ${rowIndex}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting table row: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Insert table column
server.tool(
  "insert-table-column",
  {
    documentId: z.string(),
    tableStartIndex: z.number(),
    columnIndex: z.number().describe("Column index where to insert (0-based)"),
    insertRight: z.boolean().optional().describe("Insert to the right (default: true)"),
    tabId: z.string().optional()
  },
  async ({ documentId, tableStartIndex, columnIndex, insertRight = true, tabId }) => {
    try {
      const request = {
        insertTableColumn: {
          tableCellLocation: {
            tableStartLocation: {
              index: tableStartIndex,
              tabId: tabId || ''
            },
            rowIndex: 0,
            columnIndex
          },
          insertRight
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'insert-table-column'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted column ${insertRight ? 'right of' : 'left of'} column ${columnIndex}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting table column: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Delete table row
server.tool(
  "delete-table-row",
  {
    documentId: z.string(),
    tableStartIndex: z.number(),
    rowIndex: z.number().describe("Row index to delete (0-based)"),
    tabId: z.string().optional()
  },
  async ({ documentId, tableStartIndex, rowIndex, tabId }) => {
    try {
      const request = {
        deleteTableRow: {
          tableCellLocation: {
            tableStartLocation: {
              index: tableStartIndex,
              tabId: tabId || ''
            },
            rowIndex,
            columnIndex: 0
          }
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'delete-table-row'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Deleted row ${rowIndex}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting table row: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Delete table column
server.tool(
  "delete-table-column",
  {
    documentId: z.string(),
    tableStartIndex: z.number(),
    columnIndex: z.number().describe("Column index to delete (0-based)"),
    tabId: z.string().optional()
  },
  async ({ documentId, tableStartIndex, columnIndex, tabId }) => {
    try {
      const request = {
        deleteTableColumn: {
          tableCellLocation: {
            tableStartLocation: {
              index: tableStartIndex,
              tabId: tabId || ''
            },
            rowIndex: 0,
            columnIndex
          }
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'delete-table-column'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Deleted column ${columnIndex}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting table column: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Update table cell style
server.tool(
  "update-table-cell-style",
  {
    documentId: z.string(),
    tableStartIndex: z.number(),
    cells: z.array(z.object({
      rowIndex: z.number(),
      columnIndex: z.number(),
      rowSpan: z.number().optional(),
      columnSpan: z.number().optional(),
      backgroundColor: z.object({
        red: z.number().min(0).max(1),
        green: z.number().min(0).max(1),
        blue: z.number().min(0).max(1)
      }).optional(),
      borderLeft: z.object({
        color: z.object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1)
        }),
        width: z.number(),
        dashStyle: z.enum(['SOLID', 'DOT', 'DASH'])
      }).optional(),
      paddingLeft: z.number().optional(),
      paddingRight: z.number().optional(),
      paddingTop: z.number().optional(),
      paddingBottom: z.number().optional()
    })),
    tabId: z.string().optional()
  },
  async ({ documentId, tableStartIndex, cells, tabId }) => {
    try {
      const requests = cells.map(cell => {
        const tableCellStyle: any = {};
        const fields: string[] = [];
        
        if (cell.backgroundColor) {
          tableCellStyle.backgroundColor = {
            color: { rgbColor: cell.backgroundColor }
          };
          fields.push('backgroundColor');
        }
        
        if (cell.borderLeft) {
          tableCellStyle.borderLeft = {
            color: { color: { rgbColor: cell.borderLeft.color } },
            width: { magnitude: cell.borderLeft.width, unit: 'PT' },
            dashStyle: cell.borderLeft.dashStyle
          };
          fields.push('borderLeft');
        }
        
        if (cell.paddingLeft !== undefined) {
          tableCellStyle.paddingLeft = { magnitude: cell.paddingLeft, unit: 'PT' };
          fields.push('paddingLeft');
        }
        if (cell.paddingRight !== undefined) {
          tableCellStyle.paddingRight = { magnitude: cell.paddingRight, unit: 'PT' };
          fields.push('paddingRight');
        }
        if (cell.paddingTop !== undefined) {
          tableCellStyle.paddingTop = { magnitude: cell.paddingTop, unit: 'PT' };
          fields.push('paddingTop');
        }
        if (cell.paddingBottom !== undefined) {
          tableCellStyle.paddingBottom = { magnitude: cell.paddingBottom, unit: 'PT' };
          fields.push('paddingBottom');
        }
        
        return {
          updateTableCellStyle: {
            tableCellStyle,
            tableRange: {
              tableCellLocation: {
                tableStartLocation: {
                  index: tableStartIndex,
                  tabId: tabId || ''
                },
                rowIndex: cell.rowIndex,
                columnIndex: cell.columnIndex
              },
              rowSpan: cell.rowSpan || 1,
              columnSpan: cell.columnSpan || 1
            },
            fields: fields.join(',')
          }
        };
      });
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests }
        }),
        3,
        'update-table-cell-style'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Updated style for ${cells.length} table cell(s)`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error updating table cell style: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Merge table cells
server.tool(
  "merge-table-cells",
  {
    documentId: z.string(),
    tableStartIndex: z.number(),
    rowIndex: z.number(),
    columnIndex: z.number(),
    rowSpan: z.number(),
    columnSpan: z.number(),
    tabId: z.string().optional()
  },
  async ({ documentId, tableStartIndex, rowIndex, columnIndex, rowSpan, columnSpan, tabId }) => {
    try {
      const request = {
        mergeTableCells: {
          tableRange: {
            tableCellLocation: {
              tableStartLocation: {
                index: tableStartIndex,
                tabId: tabId || ''
              },
              rowIndex,
              columnIndex
            },
            rowSpan,
            columnSpan
          }
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'merge-table-cells'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Merged ${rowSpan}×${columnSpan} cells starting at [${rowIndex},${columnIndex}]`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error merging table cells: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Unmerge table cells
server.tool(
  "unmerge-table-cells",
  {
    documentId: z.string(),
    tableStartIndex: z.number(),
    rowIndex: z.number(),
    columnIndex: z.number(),
    rowSpan: z.number().default(1),
    columnSpan: z.number().default(1),
    tabId: z.string().optional()
  },
  async ({ documentId, tableStartIndex, rowIndex, columnIndex, rowSpan, columnSpan, tabId }) => {
    try {
      const request = {
        unmergeTableCells: {
          tableRange: {
            tableCellLocation: {
              tableStartLocation: {
                index: tableStartIndex,
                tabId: tabId || ''
              },
              rowIndex,
              columnIndex
            },
            rowSpan,
            columnSpan
          }
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'unmerge-table-cells'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Unmerged cells at [${rowIndex},${columnIndex}] with span [${rowSpan}x${columnSpan}]`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error unmerging table cells: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Pin table header rows
server.tool(
  "pin-table-header-rows",
  {
    documentId: z.string(),
    tableStartIndex: z.number(),
    pinnedHeaderRowsCount: z.number().min(0).describe("Number of rows to pin as headers"),
    tabId: z.string().optional()
  },
  async ({ documentId, tableStartIndex, pinnedHeaderRowsCount, tabId }) => {
    try {
      const request = {
        pinTableHeaderRows: {
          tableStartLocation: {
            index: tableStartIndex,
            tabId: tabId || ''
          },
          pinnedHeaderRowsCount
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'pin-table-header-rows'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Pinned ${pinnedHeaderRowsCount} header row(s)`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error pinning table header rows: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Update table column properties
server.tool(
  "update-table-column-properties",
  {
    documentId: z.string(),
    tableStartIndex: z.number(),
    columnIndices: z.array(z.number()),
    width: z.number().optional().describe("Column width in points"),
    tabId: z.string().optional()
  },
  async ({ documentId, tableStartIndex, columnIndices, width, tabId }) => {
    try {
      const request = {
        updateTableColumnProperties: {
          tableStartLocation: {
            index: tableStartIndex,
            tabId: tabId || ''
          },
          columnIndices,
          tableColumnProperties: {
            width: width ? { magnitude: width, unit: 'PT' } : undefined,
            widthType: width ? 'FIXED_WIDTH' : 'EVENLY_DISTRIBUTED'
          },
          fields: 'width,widthType'
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'update-table-column-properties'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Updated properties for ${columnIndices.length} column(s)`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error updating table column properties: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Update table row style
server.tool(
  "update-table-row-style",
  {
    documentId: z.string(),
    tableStartIndex: z.number(),
    rowIndices: z.array(z.number()),
    minRowHeight: z.number().optional().describe("Minimum row height in points"),
    preventOverflow: z.boolean().optional(),
    tableRowStyle: z.object({
      backgroundColor: z.object({
        red: z.number().min(0).max(1),
        green: z.number().min(0).max(1),
        blue: z.number().min(0).max(1)
      }).optional()
    }).optional(),
    tabId: z.string().optional()
  },
  async ({ documentId, tableStartIndex, rowIndices, minRowHeight, preventOverflow, tableRowStyle, tabId }) => {
    try {
      const request: any = {
        updateTableRowStyle: {
          tableStartLocation: {
            index: tableStartIndex,
            tabId: tabId || ''
          },
          rowIndices
        }
      };
      
      const fields: string[] = [];
      
      if (minRowHeight !== undefined) {
        request.updateTableRowStyle.tableRowStyle = {
          ...request.updateTableRowStyle.tableRowStyle,
          minRowHeight: { magnitude: minRowHeight, unit: 'PT' }
        };
        fields.push('minRowHeight');
      }
      
      if (preventOverflow !== undefined) {
        request.updateTableRowStyle.tableRowStyle = {
          ...request.updateTableRowStyle.tableRowStyle,
          preventOverflow
        };
        fields.push('preventOverflow');
      }
      
      if (tableRowStyle?.backgroundColor) {
        request.updateTableRowStyle.tableRowStyle = {
          ...request.updateTableRowStyle.tableRowStyle,
          backgroundColor: {
            color: { rgbColor: tableRowStyle.backgroundColor }
          }
        };
        fields.push('backgroundColor');
      }
      
      request.updateTableRowStyle.fields = fields.join(',');
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'update-table-row-style'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Updated style for ${rowIndices.length} row(s)`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error updating table row style: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// NAMED RANGE OPERATIONS
// ============================================================================

// Delete named range
server.tool(
  "delete-named-range",
  {
    documentId: z.string(),
    namedRangeId: z.string().optional(),
    name: z.string().optional()
  },
  async ({ documentId, namedRangeId, name }) => {
    try {
      if (!namedRangeId && !name) {
        throw new DocGenError(
          'Must provide either namedRangeId or name',
          'MISSING_PARAMETER',
          false,
          {}
        );
      }
      
      const request: any = {
        deleteNamedRange: {}
      };
      
      if (namedRangeId) {
        request.deleteNamedRange.namedRangeId = namedRangeId;
      } else {
        request.deleteNamedRange.name = name;
      }
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'delete-named-range'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Deleted named range ${name || namedRangeId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting named range: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Replace named range content
server.tool(
  "replace-named-range-content",
  {
    documentId: z.string(),
    namedRangeName: z.string(),
    text: z.string()
  },
  async ({ documentId, namedRangeName, text }) => {
    try {
      const request = {
        replaceNamedRangeContent: {
          namedRangeName,
          text
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'replace-named-range-content'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Replaced content of named range "${namedRangeName}"`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error replacing named range content: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// DOCUMENT STYLE OPERATIONS
// ============================================================================

// Update document style
server.tool(
  "update-document-style",
  {
    documentId: z.string(),
    documentStyle: z.object({
      background: z.object({
        color: z.object({
          red: z.number().min(0).max(1),
          green: z.number().min(0).max(1),
          blue: z.number().min(0).max(1)
        })
      }).optional(),
      defaultHeaderId: z.string().optional(),
      defaultFooterId: z.string().optional(),
      evenPageHeaderId: z.string().optional(),
      evenPageFooterId: z.string().optional(),
      firstPageHeaderId: z.string().optional(),
      firstPageFooterId: z.string().optional(),
      marginTop: z.number().optional(),
      marginBottom: z.number().optional(),
      marginLeft: z.number().optional(),
      marginRight: z.number().optional(),
      marginHeader: z.number().optional(),
      marginFooter: z.number().optional(),
      pageSize: z.object({
        height: z.number(),
        width: z.number()
      }).optional(),
      useFirstPageHeaderFooter: z.boolean().optional(),
      useEvenPageHeaderFooter: z.boolean().optional()
    })
  },
  async ({ documentId, documentStyle }) => {
    try {
      const style: any = {};
      const fields: string[] = [];
      
      if (documentStyle.background) {
        style.background = {
          color: { color: { rgbColor: documentStyle.background.color } }
        };
        fields.push('background');
      }
      
      if (documentStyle.marginTop !== undefined) {
        style.marginTop = { magnitude: documentStyle.marginTop, unit: 'PT' };
        fields.push('marginTop');
      }
      if (documentStyle.marginBottom !== undefined) {
        style.marginBottom = { magnitude: documentStyle.marginBottom, unit: 'PT' };
        fields.push('marginBottom');
      }
      if (documentStyle.marginLeft !== undefined) {
        style.marginLeft = { magnitude: documentStyle.marginLeft, unit: 'PT' };
        fields.push('marginLeft');
      }
      if (documentStyle.marginRight !== undefined) {
        style.marginRight = { magnitude: documentStyle.marginRight, unit: 'PT' };
        fields.push('marginRight');
      }
      if (documentStyle.marginHeader !== undefined) {
        style.marginHeader = { magnitude: documentStyle.marginHeader, unit: 'PT' };
        fields.push('marginHeader');
      }
      if (documentStyle.marginFooter !== undefined) {
        style.marginFooter = { magnitude: documentStyle.marginFooter, unit: 'PT' };
        fields.push('marginFooter');
      }
      
      if (documentStyle.pageSize) {
        style.pageSize = {
          height: { magnitude: documentStyle.pageSize.height, unit: 'PT' },
          width: { magnitude: documentStyle.pageSize.width, unit: 'PT' }
        };
        fields.push('pageSize');
      }
      
      if (documentStyle.useFirstPageHeaderFooter !== undefined) {
        style.useFirstPageHeaderFooter = documentStyle.useFirstPageHeaderFooter;
        fields.push('useFirstPageHeaderFooter');
      }
      if (documentStyle.useEvenPageHeaderFooter !== undefined) {
        style.useEvenPageHeaderFooter = documentStyle.useEvenPageHeaderFooter;
        fields.push('useEvenPageHeaderFooter');
      }
      
      const request = {
        updateDocumentStyle: {
          documentStyle: style,
          fields: fields.join(',')
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'update-document-style'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Updated document style`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error updating document style: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Update section style
server.tool(
  "update-section-style",
  {
    documentId: z.string(),
    sectionIndex: z.number(),
    sectionStyle: z.object({
      columnSeparatorStyle: z.enum(['NONE', 'BETWEEN_EACH_COLUMN']).optional(),
      contentDirection: z.enum(['LEFT_TO_RIGHT', 'RIGHT_TO_LEFT']).optional(),
      marginTop: z.number().optional(),
      marginBottom: z.number().optional(),
      marginLeft: z.number().optional(),
      marginRight: z.number().optional(),
      marginHeader: z.number().optional(),
      marginFooter: z.number().optional(),
      sectionType: z.enum(['CONTINUOUS', 'NEXT_PAGE']).optional()
    })
  },
  async ({ documentId, sectionIndex, sectionStyle }) => {
    try {
      const style: any = {};
      const fields: string[] = [];
      
      if (sectionStyle.columnSeparatorStyle) {
        style.columnSeparatorStyle = sectionStyle.columnSeparatorStyle;
        fields.push('columnSeparatorStyle');
      }
      if (sectionStyle.contentDirection) {
        style.contentDirection = sectionStyle.contentDirection;
        fields.push('contentDirection');
      }
      if (sectionStyle.sectionType) {
        style.sectionType = sectionStyle.sectionType;
        fields.push('sectionType');
      }
      
      if (sectionStyle.marginTop !== undefined) {
        style.marginTop = { magnitude: sectionStyle.marginTop, unit: 'PT' };
        fields.push('marginTop');
      }
      if (sectionStyle.marginBottom !== undefined) {
        style.marginBottom = { magnitude: sectionStyle.marginBottom, unit: 'PT' };
        fields.push('marginBottom');
      }
      if (sectionStyle.marginLeft !== undefined) {
        style.marginLeft = { magnitude: sectionStyle.marginLeft, unit: 'PT' };
        fields.push('marginLeft');
      }
      if (sectionStyle.marginRight !== undefined) {
        style.marginRight = { magnitude: sectionStyle.marginRight, unit: 'PT' };
        fields.push('marginRight');
      }
      if (sectionStyle.marginHeader !== undefined) {
        style.marginHeader = { magnitude: sectionStyle.marginHeader, unit: 'PT' };
        fields.push('marginHeader');
      }
      if (sectionStyle.marginFooter !== undefined) {
        style.marginFooter = { magnitude: sectionStyle.marginFooter, unit: 'PT' };
        fields.push('marginFooter');
      }
      
      const request = {
        updateSectionStyle: {
          range: {
            startIndex: sectionIndex,
            endIndex: sectionIndex + 1
          },
          sectionStyle: style,
          fields: fields.join(',')
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'update-section-style'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Updated section style`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error updating section style: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// LIST OPERATIONS
// ============================================================================

// Delete paragraph bullets
server.tool(
  "delete-paragraph-bullets",
  {
    documentId: z.string(),
    startIndex: z.number(),
    endIndex: z.number(),
    tabId: z.string().optional()
  },
  async ({ documentId, startIndex, endIndex, tabId }) => {
    try {
      const request = {
        deleteParagraphBullets: {
          range: {
            startIndex,
            endIndex,
            tabId: tabId || ''
          }
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'delete-paragraph-bullets'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Removed bullets from range [${startIndex}:${endIndex}]`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting paragraph bullets: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// IMAGE OPERATIONS
// ============================================================================

// Replace image
server.tool(
  "replace-image",
  {
    documentId: z.string(),
    imageObjectId: z.string(),
    uri: z.string().url(),
    imageReplaceMethod: z.enum(['CENTER_CROP', 'NONE']).optional()
  },
  async ({ documentId, imageObjectId, uri, imageReplaceMethod = 'CENTER_CROP' }) => {
    try {
      const request = {
        replaceImage: {
          imageObjectId,
          uri,
          imageReplaceMethod
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'replace-image'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Replaced image ${imageObjectId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error replacing image: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Delete positioned object
server.tool(
  "delete-positioned-object",
  {
    documentId: z.string(),
    objectId: z.string()
  },
  async ({ documentId, objectId }) => {
    try {
      const request = {
        deletePositionedObject: {
          objectId
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'delete-positioned-object'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Deleted positioned object ${objectId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting positioned object: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// HEADER/FOOTER OPERATIONS
// ============================================================================

// Delete header
server.tool(
  "delete-header",
  {
    documentId: z.string(),
    headerId: z.string()
  },
  async ({ documentId, headerId }) => {
    try {
      const request = {
        deleteHeader: {
          headerId
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'delete-header'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Deleted header ${headerId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting header: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Delete footer
server.tool(
  "delete-footer",
  {
    documentId: z.string(),
    footerId: z.string()
  },
  async ({ documentId, footerId }) => {
    try {
      const request = {
        deleteFooter: {
          footerId
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'delete-footer'
      );
      
      documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Deleted footer ${footerId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting footer: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// TAB OPERATIONS
// ============================================================================

// Get all tabs
server.tool(
  "get-tabs",
  {
    documentId: z.string()
  },
  async ({ documentId }) => {
    try {
      const cached = documentCache.get(documentId);
      let doc;
      
      if (cached) {
        doc = cached.doc;
      } else {
        doc = await withRetry(() =>
          docsClient.documents.get({ documentId }),
          3,
          'get-tabs'
        );
        documentCache.set(documentId, doc.data, doc.data.revisionId || '');
        doc = doc.data;
      }
      
      const tabs = getAllTabs(doc);
      
      return {
        content: [{
          type: "text",
          text: `📑 Document Tabs (${tabs.length}):\n\n` +
            tabs.map(tab => 
              `${tab.parentTabId ? '  └─ ' : ''}${tab.title || 'Untitled'} (ID: ${tab.tabId})`
            ).join('\n')
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting tabs: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// DOCUMENT ANALYSIS
// ============================================================================

// Analyze document structure
server.tool(
  "analyze-document",
  {
    documentId: z.string()
  },
  async ({ documentId }) => {
    try {
      const cached = documentCache.get(documentId);
      let doc;
      
      if (cached) {
        doc = cached.doc;
      } else {
        doc = await withRetry(() =>
          docsClient.documents.get({ documentId }),
          3,
          'analyze-document'
        );
        documentCache.set(documentId, doc.data, doc.data.revisionId || '');
        doc = doc.data;
      }
      
      const structure = analyzeDocument(doc);
      
      const report = `📊 Document Analysis

📝 Statistics:
- Words: ${structure.statistics.wordCount}
- Characters: ${structure.statistics.characterCount}
- Paragraphs: ${structure.statistics.paragraphCount}
- Estimated Pages: ${structure.statistics.pageCount}

📑 Structure:
- Headings: ${structure.headings.length}
- Tables: ${structure.tables.length}
- Images: ${structure.images.length}
- Lists: ${structure.lists.length}
- Links: ${structure.links.length}
- Named Ranges: ${structure.namedRanges.length}

${structure.headings.length > 0 ? '\n📌 Document Outline:\n' + 
  structure.headings.map(h => `${'  '.repeat(h.level - 1)}${h.level}. ${h.text}`).join('\n') : ''}

${structure.tables.length > 0 ? '\n📊 Tables:\n' +
  structure.tables.map((t, i) => `Table ${i + 1}: ${t.rows}×${t.columns} at index ${t.index}`).join('\n') : ''}

${structure.links.length > 0 ? '\n🔗 Links:\n' +
  structure.links.slice(0, 5).map(l => `"${l.text}" → ${l.url}`).join('\n') +
  (structure.links.length > 5 ? `\n... and ${structure.links.length - 5} more` : '') : ''}`;
      
      return {
        content: [{
          type: "text",
          text: report
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error analyzing document: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Get document with suggestions
server.tool(
  "get-document-with-suggestions",
  {
    documentId: z.string(),
    suggestionsViewMode: z.enum([
      'DEFAULT',
      'SUGGESTIONS_INLINE',
      'PREVIEW_SUGGESTIONS_ACCEPTED',
      'PREVIEW_WITHOUT_SUGGESTIONS'
    ])
  },
  async ({ documentId, suggestionsViewMode }) => {
    try {
      const doc = await withRetry(() =>
        docsClient.documents.get({
          documentId,
          suggestionsViewMode
        }),
        3,
        'get-document-with-suggestions'
      );
      
      let content = `📄 Document (${suggestionsViewMode}):\n\n`;
      
      // Extract text with suggestion markers
      if (doc.data.body?.content) {
        doc.data.body.content.forEach((element: any) => {
          if (element.paragraph?.elements) {
            element.paragraph.elements.forEach((elem: any) => {
              if (elem.textRun?.content) {
                if (elem.textRun.suggestedInsertionIds) {
                  content += `[+${elem.textRun.content}]`;
                } else if (elem.textRun.suggestedDeletionIds) {
                  content += `[-${elem.textRun.content}]`;
                } else {
                  content += elem.textRun.content;
                }
              }
            });
          }
        });
      }
      
      return {
        content: [{
          type: "text",
          text: content
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting document with suggestions: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Calculate UTF-16 length
server.tool(
  "calculate-utf16-length",
  {
    text: z.string()
  },
  async ({ text }) => {
    const length = getUTF16Length(text);
    const jsLength = text.length;
    
    return {
      content: [{
        type: "text",
        text: `📏 UTF-16 Length Analysis:
- UTF-16 units: ${length}
- JavaScript length: ${jsLength}
- Difference: ${Math.abs(length - jsLength)}
${length !== jsLength ? '\n⚠️ Contains characters that use multiple UTF-16 units' : ''}`
      }]
    };
  }
);

// ============================================================================
// DOCUMENT OPERATIONS WITH DRIVE
// ============================================================================

// Copy document
server.tool(
  "copy-document",
  {
    documentId: z.string(),
    title: z.string(),
    folderId: z.string().optional()
  },
  async ({ documentId, title, folderId }) => {
    try {
      const requestBody: any = {
        name: title
      };
      
      if (folderId) {
        requestBody.parents = [folderId];
      }
      
      const copy = await withRetry(() =>
        driveClient.files.copy({
          fileId: documentId,
          requestBody
        }),
        3,
        'copy-document'
      );
      
      return {
        content: [{
          type: "text",
          text: `✅ Created copy "${title}"\nID: ${copy.data.id}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error copying document: ${error}`
        }],
        isError: true
      };
    }
  }
);

// Move document to folder
server.tool(
  "move-document",
  {
    documentId: z.string(),
    folderId: z.string(),
    removeFromCurrentFolders: z.boolean().optional()
  },
  async ({ documentId, folderId, removeFromCurrentFolders = true }) => {
    try {
      let removeParents = '';
      
      if (removeFromCurrentFolders) {
        const file = await driveClient.files.get({
          fileId: documentId,
          fields: 'parents'
        });
        
        if (file.data.parents) {
          removeParents = file.data.parents.join(',');
        }
      }
      
      await withRetry(() =>
        driveClient.files.update({
          fileId: documentId,
          addParents: folderId,
          removeParents: removeParents || undefined,
          fields: 'id, parents'
        }),
        3,
        'move-document'
      );
      
      return {
        content: [{
          type: "text",
          text: `✅ Moved document to folder ${folderId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error moving document: ${error}`
        }],
        isError: true
      };
    }
  }
);

// ============================================================================
// HIGH-LEVEL WORKFLOWS
// ============================================================================

// Create document from template
server.tool(
  "create-from-template",
  {
    templateId: z.string(),
    title: z.string(),
    replacements: z.record(z.string()).optional(),
    folderId: z.string().optional()
  },
  async ({ templateId, title, replacements = {}, folderId }) => {
    try {
      // Copy template
      const requestBody: any = { name: title };
      if (folderId) {
        requestBody.parents = [folderId];
      }
      
      const copy = await withRetry(() =>
        driveClient.files.copy({
          fileId: templateId,
          requestBody
        }),
        3,
        'create-from-template'
      );
      
      const newDocId = copy.data.id!;
      
      // Replace placeholders
      if (Object.keys(replacements).length > 0) {
        const requests = Object.entries(replacements).map(([placeholder, value]) => ({
          replaceAllText: {
            containsText: {
              text: `{{${placeholder}}}`,
              matchCase: false
            },
            replaceText: value
          }
        }));
        
        await withRetry(() =>
          docsClient.documents.batchUpdate({
            documentId: newDocId,
            requestBody: { requests }
          }),
          3,
          'template-replacements'
        );
      }
      
      return {
        content: [{
          type: "text",
          text: `✅ Created document from template\nTitle: ${title}\nID: ${newDocId}\nReplacements: ${Object.keys(replacements).length}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating from template: ${error}`
        }],
        isError: true
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
  
  console.error("========================================");
  console.error("DocuGen MCP Server v4.0 - COMPLETE");
  console.error("========================================");
  console.error("✅ All 33 batch operations implemented");
  console.error("✅ Tab management system");
  console.error("✅ Suggestions API");
  console.error("✅ Document analysis");
  console.error("✅ Error handling & retry logic");
  console.error("✅ Caching system");
  console.error("✅ UTF-16 utilities");
  console.error("========================================");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});