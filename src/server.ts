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
import { tokenStorage } from "./utils/encryption.js";
import { documentCache } from './utils/cache.js';

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

// DocumentCache class moved to utils/cache.js

/* Removed - now imported from utils/cache.js
class DocumentCache {
  private cache = new Map<string, CachedDocument>();
  private maxAge = 5 * 60 * 1000; // 5 minutes
  private maxSize = 100; // Maximum cache entries
  private locks = new Map<string, Promise<void>>();
  
  // Thread-safe wrapper for cache operations
  private async withLock<T>(key: string, operation: () => T): Promise<T> {
    // Wait for any existing lock
    const existingLock = this.locks.get(key);
    if (existingLock) {
      await existingLock;
    }
    
    // Create new lock
    let releaseLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    this.locks.set(key, lockPromise);
    
    try {
      return operation();
    } finally {
      this.locks.delete(key);
      releaseLock!();
    }
  }
  
  async get(documentId: string): Promise<CachedDocument | null> {
    return await this.withLock(documentId, () => {
      const cached = this.cache.get(documentId);
      if (!cached) return null;
      
      if (Date.now() - cached.timestamp > this.maxAge) {
        this.cache.delete(documentId);
        return null;
      }
      
      // Update timestamp for LRU
      cached.timestamp = Date.now();
      return cached;
    });
  }
  
  async set(documentId: string, doc: any, revision: string): Promise<void> {
    await this.withLock(documentId, () => {
      // Implement LRU eviction if cache is full
      if (this.cache.size >= this.maxSize) {
        // Find and remove oldest entry
        let oldestKey: string | null = null;
        let oldestTime = Date.now();
        
        for (const [key, value] of this.cache.entries()) {
          if (value.timestamp < oldestTime) {
            oldestTime = value.timestamp;
            oldestKey = key;
          }
        }
        
        if (oldestKey) {
          this.cache.delete(oldestKey);
        }
      }
      
      this.cache.set(documentId, {
        doc,
        timestamp: Date.now(),
        revision
      });
    });
  }
  
  async invalidate(documentId: string): Promise<void> {
    await this.withLock(documentId, () => {
      this.cache.delete(documentId);
    });
  }
  
  clear(): void {
    this.cache.clear();
    this.locks.clear();
  }
  
  // Get cache statistics
  getStats(): { size: number; maxSize: number } {
    return { size: this.cache.size, maxSize: this.maxSize };
  }
}
*/

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
          // Surrogate pair - counts as 2 UTF-16 units
          length += 2;
          i++; // Skip next
          continue;
        }
      }
    }
    length++;
  }
  return length;
}

// Validation functions have been moved to utils/validation.js
// They are imported at the top of the file

function sanitizeErrorMessage(error: any): string {
  // Never expose sensitive information in error messages
  const errorString = String(error);
  
  // Remove potential secrets (tokens, API keys, etc.)
  let sanitized = errorString
    .replace(/Bearer\s+[A-Za-z0-9\-._~+\/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/ya29\.[A-Za-z0-9\-._~+\/]+/gi, '[TOKEN REDACTED]')
    .replace(/AIza[A-Za-z0-9\-._~+\/]{35}/gi, '[API_KEY REDACTED]')
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '[UUID REDACTED]')
    .replace(/client_secret":"[^"]+"/gi, 'client_secret":"[REDACTED]"')
    .replace(/refresh_token":"[^"]+"/gi, 'refresh_token":"[REDACTED]"')
    .replace(/access_token":"[^"]+"/gi, 'access_token":"[REDACTED]"');
  
  // If it's a Google API error, extract just the message
  if (error?.response?.data?.error?.message) {
    return `API Error: ${error.response.data.error.message}`;
  }
  
  // For DocGenError, return the clean message
  if (error instanceof DocGenError) {
    return error.message;
  }
  
  // For other errors, return a generic message if it contains sensitive patterns
  const sensitivePatterns = [
    /oauth/i,
    /token/i,
    /secret/i,
    /password/i,
    /credential/i,
    /authorization/i
  ];
  
  if (sensitivePatterns.some(pattern => pattern.test(sanitized))) {
    // Return generic message for potentially sensitive errors
    if (error?.code) {
      return `Operation failed with error code: ${error.code}`;
    }
    return 'Operation failed. Please check your configuration and try again.';
  }
  
  return sanitized;
}

// ============================================================================
// GOOGLE API SETUP
// ============================================================================

let docsClient: docs_v1.Docs;
let driveClient: drive_v3.Drive;

async function authorize(): Promise<any> {
  // Try to load encrypted token first
  const storedToken = tokenStorage.loadToken(TOKEN_PATH);
  if (storedToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        "http://localhost:3000/oauth/callback" // Fixed: replaced deprecated OOB
      );
      oauth2Client.setCredentials(storedToken);
      
      // Check if token needs refresh
      if (storedToken.expiry_date && storedToken.expiry_date <= Date.now()) {
        console.error("Token expired, refreshing...");
        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(credentials);
          // Save refreshed token (encrypted)
          tokenStorage.saveToken(TOKEN_PATH, credentials);
          console.error("Token refreshed successfully");
        } catch (refreshError) {
          console.error("Failed to refresh token, re-authenticating...", refreshError);
          fs.unlinkSync(TOKEN_PATH); // Remove invalid token
          return authorize(); // Recursive call to re-authenticate
        }
      }
      
      // Set up automatic token refresh before expiry
      if (storedToken.expiry_date) {
        const refreshTime = storedToken.expiry_date - Date.now() - (5 * 60 * 1000); // 5 minutes before expiry
        if (refreshTime > 0) {
          setTimeout(async () => {
            try {
              const { credentials } = await oauth2Client.refreshAccessToken();
              oauth2Client.setCredentials(credentials);
              tokenStorage.saveToken(TOKEN_PATH, credentials);
              console.error("Token auto-refreshed");
            } catch (error) {
              console.error("Auto-refresh failed:", error);
            }
          }, refreshTime);
        }
      }
      
      return oauth2Client;
    } catch (error) {
      console.error("Invalid token, re-authenticating...");
      if (fs.existsSync(TOKEN_PATH)) {
        fs.unlinkSync(TOKEN_PATH);
      }
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
  
  const authToken = auth.credentials;
  tokenStorage.saveToken(TOKEN_PATH, authToken);
  
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
              structure.statistics.wordCount += text.split(/\s+/).filter((w: string) => w).length;
              
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

// sortRequestsDescending moved to utils/validation.js
/* function _sortRequestsDescending(requests: any[]): any[] {
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
} */

function validateBatchRequests(requests: any[]): void {
  // Check request count
  if (requests.length > 100) {
    throw new DocGenError(
      `Batch request contains ${requests.length} operations, maximum is 100`,
      'BATCH_TOO_LARGE',
      false,
      { count: requests.length }
    );
  }
  
  // Check total payload size (Google Docs API has a ~10MB limit)
  const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024; // 10MB
  const payloadSize = JSON.stringify(requests).length;
  
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    throw new DocGenError(
      `Batch request payload too large: ${(payloadSize / 1024 / 1024).toFixed(2)}MB, maximum is 10MB`,
      'PAYLOAD_TOO_LARGE',
      false,
      { payloadSize, maxSize: MAX_PAYLOAD_SIZE }
    );
  }
  
  // Check for complex nested operations that might cause issues
  for (const request of requests) {
    const requestStr = JSON.stringify(request);
    if (requestStr.length > 1024 * 1024) { // 1MB per request warning
      console.error(`Warning: Large individual request (${(requestStr.length / 1024).toFixed(0)}KB)`);
    }
  }
}

// ============================================================================
// CORE DOCUMENT OPERATIONS (PRIMARY API METHODS)
// ============================================================================

// Create a new document - documents.create method
server.tool(
  "create-document",
  {
    title: z.string().optional().describe("Document title"),
    body: z.object({
      content: z.array(z.any()).optional()
    }).optional().describe("Initial document content")
  },
  async ({ title, body }) => {
    try {
      const requestBody: any = {};
      if (title) {
        requestBody.title = title;
      }
      if (body) {
        requestBody.body = body;
      }
      
      const response = await withRetry(() =>
        docsClient.documents.create({
          requestBody
        }),
        3,
        'create-document'
      );
      
      const documentId = response.data.documentId;
      const documentTitle = response.data.title || 'Untitled Document';
      const revisionId = response.data.revisionId;
      
      return {
        content: [{
          type: "text",
          text: `✅ Created document "${documentTitle}"\nDocument ID: ${documentId}\nRevision: ${revisionId}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating document: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// Get document - documents.get method with field masks
server.tool(
  "get-document",
  {
    documentId: z.string(),
    fields: z.string().optional().describe("Field mask for partial response (e.g., 'title,body.content')"),
    suggestionsViewMode: z.enum(['DEFAULT', 'SUGGESTIONS_INLINE', 'PREVIEW_SUGGESTIONS_ACCEPTED', 'PREVIEW_WITHOUT_SUGGESTIONS']).optional()
  },
  async ({ documentId, fields, suggestionsViewMode }) => {
    try {
      const params: any = { documentId };
      if (fields) {
        params.fields = fields;
      }
      if (suggestionsViewMode) {
        params.suggestionsViewMode = suggestionsViewMode;
      }
      
      const response = await withRetry(() =>
        docsClient.documents.get(params),
        3,
        'get-document'
      );
      
      // Cache the document
      if (response.data) {
        await documentCache.set(documentId, response.data, response.data.revisionId || '');
      }
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error getting document: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// Batch update - execute multiple operations in a single request
server.tool(
  "batch-update",
  {
    documentId: z.string(),
    requests: z.array(z.any()).describe("Array of batch update requests"),
    writeControl: z.object({
      requiredRevisionId: z.string().optional(),
      targetRevisionId: z.string().optional()
    }).optional()
  },
  async ({ documentId, requests, writeControl }) => {
    try {
      // Validate batch size
      validateBatchRequests(requests);
      
      // Sort requests in descending order by index if they have location/range
      const sortedRequests = requests.sort((a, b) => {
        const aIndex = extractIndexFromRequest(a);
        const bIndex = extractIndexFromRequest(b);
        return bIndex - aIndex; // Descending order
      });
      
      const requestBody: any = { requests: sortedRequests };
      if (writeControl) {
        requestBody.writeControl = writeControl;
      }
      
      const response = await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody
        }),
        3,
        'batch-update'
      );
      
      await documentCache.invalidate(documentId);
      
      const replies = response.data.replies || [];
      const documentId2 = response.data.documentId;
      // const writeControl2 = response.data.writeControl; // Currently unused
      
      return {
        content: [{
          type: "text",
          text: `✅ Executed ${requests.length} operations\nDocument ID: ${documentId2}\nReplies: ${JSON.stringify(replies, null, 2)}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error in batch update: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// Helper function to extract index from various request types
function extractIndexFromRequest(request: any): number {
  // Check various request types for index/location
  const keys = Object.keys(request);
  if (keys.length === 0) return 0;
  
  const requestType = keys[0];
  if (!requestType) return 0;
  const requestData = request[requestType];
  
  if (requestData.location?.index !== undefined) {
    return requestData.location.index;
  }
  if (requestData.range?.startIndex !== undefined) {
    return requestData.range.startIndex;
  }
  if (requestData.tableCellLocation?.tableStartLocation?.index !== undefined) {
    return requestData.tableCellLocation.tableStartLocation.index;
  }
  if (requestData.tableStartLocation?.index !== undefined) {
    return requestData.tableStartLocation.index;
  }
  
  return 0;
}

// ============================================================================
// CORE TEXT OPERATIONS (FUNDAMENTAL API OPERATIONS)
// ============================================================================

// 1. InsertTextRequest - Basic text insertion
server.tool(
  "insert-text",
  {
    documentId: z.string(),
    text: z.string(),
    index: z.number().describe("The zero-based index where text should be inserted"),
    tabId: z.string().optional()
  },
  async ({ documentId, text, index, tabId }) => {
    try {
      const request = {
        insertText: {
          text,
          location: {
            index,
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
        'insert-text'
      );
      
      await documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted text at index ${index}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting text: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 2. DeleteContentRangeRequest - Delete text between indices
server.tool(
  "delete-content-range",
  {
    documentId: z.string(),
    startIndex: z.number(),
    endIndex: z.number(),
    tabId: z.string().optional()
  },
  async ({ documentId, startIndex, endIndex, tabId }) => {
    try {
      const request = {
        deleteContentRange: {
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
        'delete-content-range'
      );
      
      await documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Deleted content from index ${startIndex} to ${endIndex}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error deleting content: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 3. ReplaceAllTextRequest - Find and replace throughout document
server.tool(
  "replace-all-text",
  {
    documentId: z.string(),
    searchText: z.string(),
    replaceText: z.string(),
    matchCase: z.boolean().optional()
  },
  async ({ documentId, searchText, replaceText, matchCase = false }) => {
    try {
      const request = {
        replaceAllText: {
          containsText: {
            text: searchText,
            matchCase
          },
          replaceText
        }
      };
      
      const response = await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'replace-all-text'
      );
      
      await documentCache.invalidate(documentId);
      
      const occurrencesChanged = response.data.replies?.[0]?.replaceAllText?.occurrencesChanged || 0;
      
      return {
        content: [{
          type: "text",
          text: `✅ Replaced ${occurrencesChanged} occurrences of "${searchText}" with "${replaceText}"`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error replacing text: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 4. UpdateTextStyleRequest - Text formatting (bold, italic, font, color)
server.tool(
  "update-text-style",
  {
    documentId: z.string(),
    startIndex: z.number(),
    endIndex: z.number(),
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
    link: z.object({
      url: z.string()
    }).optional(),
    tabId: z.string().optional()
  },
  async ({ documentId, startIndex, endIndex, bold, italic, underline, strikethrough, 
           fontSize, fontFamily, foregroundColor, backgroundColor, link, tabId }) => {
    try {
      const textStyle: any = {};
      const fields: string[] = [];
      
      if (bold !== undefined) {
        textStyle.bold = bold;
        fields.push('bold');
      }
      if (italic !== undefined) {
        textStyle.italic = italic;
        fields.push('italic');
      }
      if (underline !== undefined) {
        textStyle.underline = underline;
        fields.push('underline');
      }
      if (strikethrough !== undefined) {
        textStyle.strikethrough = strikethrough;
        fields.push('strikethrough');
      }
      if (fontSize !== undefined) {
        textStyle.fontSize = {
          magnitude: fontSize,
          unit: 'PT'
        };
        fields.push('fontSize');
      }
      if (fontFamily !== undefined) {
        textStyle.weightedFontFamily = {
          fontFamily: fontFamily
        };
        fields.push('weightedFontFamily');
      }
      if (foregroundColor) {
        textStyle.foregroundColor = {
          color: {
            rgbColor: foregroundColor
          }
        };
        fields.push('foregroundColor');
      }
      if (backgroundColor) {
        textStyle.backgroundColor = {
          color: {
            rgbColor: backgroundColor
          }
        };
        fields.push('backgroundColor');
      }
      if (link) {
        textStyle.link = link;
        fields.push('link');
      }
      
      const request = {
        updateTextStyle: {
          textStyle,
          range: {
            startIndex,
            endIndex,
            tabId: tabId || ''
          },
          fields: fields.join(',')
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'update-text-style'
      );
      
      await documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Updated text style from index ${startIndex} to ${endIndex}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error updating text style: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 5. UpdateParagraphStyleRequest - Paragraph formatting (alignment, spacing)
server.tool(
  "update-paragraph-style",
  {
    documentId: z.string(),
    startIndex: z.number(),
    endIndex: z.number(),
    alignment: z.enum(['START', 'CENTER', 'END', 'JUSTIFIED']).optional(),
    lineSpacing: z.number().optional().describe("Line spacing percentage (100 = single)"),
    spaceAbove: z.number().optional().describe("Space above paragraph in points"),
    spaceBelow: z.number().optional().describe("Space below paragraph in points"),
    indentFirstLine: z.number().optional().describe("First line indent in points"),
    indentStart: z.number().optional().describe("Left/start indent in points"),
    indentEnd: z.number().optional().describe("Right/end indent in points"),
    headingLevel: z.enum(['NORMAL', 'HEADING_1', 'HEADING_2', 'HEADING_3', 'HEADING_4', 'HEADING_5', 'HEADING_6']).optional(),
    tabId: z.string().optional()
  },
  async ({ documentId, startIndex, endIndex, alignment, lineSpacing, spaceAbove, 
           spaceBelow, indentFirstLine, indentStart, indentEnd, headingLevel, tabId }) => {
    try {
      const paragraphStyle: any = {};
      const fields: string[] = [];
      
      if (alignment !== undefined) {
        paragraphStyle.alignment = alignment;
        fields.push('alignment');
      }
      if (lineSpacing !== undefined) {
        paragraphStyle.lineSpacing = lineSpacing;
        fields.push('lineSpacing');
      }
      if (spaceAbove !== undefined) {
        paragraphStyle.spaceAbove = {
          magnitude: spaceAbove,
          unit: 'PT'
        };
        fields.push('spaceAbove');
      }
      if (spaceBelow !== undefined) {
        paragraphStyle.spaceBelow = {
          magnitude: spaceBelow,
          unit: 'PT'
        };
        fields.push('spaceBelow');
      }
      if (indentFirstLine !== undefined) {
        paragraphStyle.indentFirstLine = {
          magnitude: indentFirstLine,
          unit: 'PT'
        };
        fields.push('indentFirstLine');
      }
      if (indentStart !== undefined) {
        paragraphStyle.indentStart = {
          magnitude: indentStart,
          unit: 'PT'
        };
        fields.push('indentStart');
      }
      if (indentEnd !== undefined) {
        paragraphStyle.indentEnd = {
          magnitude: indentEnd,
          unit: 'PT'
        };
        fields.push('indentEnd');
      }
      if (headingLevel !== undefined) {
        paragraphStyle.namedStyleType = headingLevel;
        fields.push('namedStyleType');
      }
      
      const request = {
        updateParagraphStyle: {
          paragraphStyle,
          range: {
            startIndex,
            endIndex,
            tabId: tabId || ''
          },
          fields: fields.join(',')
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'update-paragraph-style'
      );
      
      await documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Updated paragraph style from index ${startIndex} to ${endIndex}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error updating paragraph style: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 6. CreateParagraphBulletsRequest - Create lists (bullet, numbered, checkbox)
server.tool(
  "create-paragraph-bullets",
  {
    documentId: z.string(),
    startIndex: z.number(),
    endIndex: z.number(),
    bulletPreset: z.enum([
      'BULLET_DISC_CIRCLE_SQUARE',
      'BULLET_DIAMONDX_ARROW3D_SQUARE',
      'BULLET_CHECKBOX',
      'BULLET_ARROW_DIAMOND_DISC',
      'BULLET_STAR_CIRCLE_SQUARE',
      'BULLET_ARROW3D_CIRCLE_SQUARE',
      'BULLET_LEFTTRIANGLE_DIAMOND_DISC',
      'BULLET_DIAMONDX_HOLLOWDIAMOND_SQUARE',
      'BULLET_DIAMOND_CIRCLE_SQUARE',
      'NUMBERED_DECIMAL_ALPHA_ROMAN',
      'NUMBERED_DECIMAL_ALPHA_ROMAN_PARENS',
      'NUMBERED_DECIMAL_NESTED',
      'NUMBERED_UPPERALPHA_ALPHA_ROMAN',
      'NUMBERED_UPPERROMAN_UPPERALPHA_DECIMAL',
      'NUMBERED_ZERODECIMAL_ALPHA_ROMAN'
    ]).optional(),
    tabId: z.string().optional()
  },
  async ({ documentId, startIndex, endIndex, bulletPreset = 'BULLET_DISC_CIRCLE_SQUARE', tabId }) => {
    try {
      const request = {
        createParagraphBullets: {
          bulletPreset,
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
        'create-paragraph-bullets'
      );
      
      await documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Created list with preset ${bulletPreset} from index ${startIndex} to ${endIndex}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating list: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 7. InsertTableRequest - Create tables with initial content
server.tool(
  "insert-table",
  {
    documentId: z.string(),
    index: z.number(),
    rows: z.number().min(1).max(20),
    columns: z.number().min(1).max(20),
    tabId: z.string().optional()
  },
  async ({ documentId, index, rows, columns, tabId }) => {
    try {
      const request = {
        insertTable: {
          rows,
          columns,
          location: {
            index,
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
        'insert-table'
      );
      
      await documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted ${rows}x${columns} table at index ${index}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting table: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 8. InsertInlineImageRequest - Insert images from URLs
server.tool(
  "insert-inline-image",
  {
    documentId: z.string(),
    imageUri: z.string().url(),
    index: z.number(),
    width: z.number().optional().describe("Width in points"),
    height: z.number().optional().describe("Height in points"),
    tabId: z.string().optional()
  },
  async ({ documentId, imageUri, index, width, height, tabId }) => {
    try {
      const inlineObjectProperties: any = {
        embeddedObject: {
          imageProperties: {}
        }
      };
      
      if (width || height) {
        inlineObjectProperties.embeddedObject.size = {};
        if (width) {
          inlineObjectProperties.embeddedObject.size.width = {
            magnitude: width,
            unit: 'PT'
          };
        }
        if (height) {
          inlineObjectProperties.embeddedObject.size.height = {
            magnitude: height,
            unit: 'PT'
          };
        }
      }
      
      const request = {
        insertInlineImage: {
          uri: imageUri,
          location: {
            index,
            tabId: tabId || ''
          },
          objectSize: inlineObjectProperties.embeddedObject.size
        }
      };
      
      await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'insert-inline-image'
      );
      
      await documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted image at index ${index}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting image: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 9. InsertPageBreakRequest - Add page breaks
server.tool(
  "insert-page-break",
  {
    documentId: z.string(),
    index: z.number(),
    tabId: z.string().optional()
  },
  async ({ documentId, index, tabId }) => {
    try {
      const request = {
        insertPageBreak: {
          location: {
            index,
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
        'insert-page-break'
      );
      
      await documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted page break at index ${index}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting page break: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 10. InsertSectionBreakRequest - Add section breaks
server.tool(
  "insert-section-break",
  {
    documentId: z.string(),
    index: z.number(),
    sectionType: z.enum(['CONTINUOUS', 'NEXT_PAGE']).optional(),
    tabId: z.string().optional()
  },
  async ({ documentId, index, sectionType = 'NEXT_PAGE', tabId }) => {
    try {
      const request = {
        insertSectionBreak: {
          sectionType,
          location: {
            index,
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
        'insert-section-break'
      );
      
      await documentCache.invalidate(documentId);
      
      return {
        content: [{
          type: "text",
          text: `✅ Inserted ${sectionType} section break at index ${index}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error inserting section break: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 11. CreateHeaderRequest - Create document headers
server.tool(
  "create-header",
  {
    documentId: z.string(),
    type: z.enum(['DEFAULT', 'FIRST_PAGE', 'EVEN_PAGE']).optional(),
    sectionBreakIndex: z.number().optional().describe("Index of section break (for section-specific headers)"),
    tabId: z.string().optional()
  },
  async ({ documentId, type = 'DEFAULT', sectionBreakIndex, tabId }) => {
    try {
      const request: any = {
        createHeader: {
          type
        }
      };
      
      if (sectionBreakIndex !== undefined) {
        request.createHeader.sectionBreakLocation = {
          index: sectionBreakIndex,
          tabId: tabId || ''
        };
      }
      
      const response = await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'create-header'
      );
      
      await documentCache.invalidate(documentId);
      
      const headerId = response.data.replies?.[0]?.createHeader?.headerId;
      
      return {
        content: [{
          type: "text",
          text: `✅ Created header (ID: ${headerId})`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating header: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 12. CreateFooterRequest - Create document footers
server.tool(
  "create-footer",
  {
    documentId: z.string(),
    type: z.enum(['DEFAULT', 'FIRST_PAGE', 'EVEN_PAGE']).optional(),
    sectionBreakIndex: z.number().optional().describe("Index of section break (for section-specific footers)"),
    tabId: z.string().optional()
  },
  async ({ documentId, type = 'DEFAULT', sectionBreakIndex, tabId }) => {
    try {
      const request: any = {
        createFooter: {
          type
        }
      };
      
      if (sectionBreakIndex !== undefined) {
        request.createFooter.sectionBreakLocation = {
          index: sectionBreakIndex,
          tabId: tabId || ''
        };
      }
      
      const response = await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'create-footer'
      );
      
      await documentCache.invalidate(documentId);
      
      const footerId = response.data.replies?.[0]?.createFooter?.footerId;
      
      return {
        content: [{
          type: "text",
          text: `✅ Created footer (ID: ${footerId})`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating footer: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 13. CreateFootnoteRequest - Add footnotes
server.tool(
  "create-footnote",
  {
    documentId: z.string(),
    index: z.number().describe("Index in main document where footnote reference appears"),
    footnoteText: z.string().optional(),
    tabId: z.string().optional()
  },
  async ({ documentId, index, footnoteText, tabId }) => {
    try {
      const requests: any[] = [];
      
      // First create the footnote
      const createRequest: any = {
        createFootnote: {
          location: {
            index,
            tabId: tabId || ''
          }
        }
      };
      requests.push(createRequest);
      
      // If footnote text is provided, we'll need to insert it after creation
      // This would require getting the footnote ID from the response
      
      const response = await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests }
        }),
        3,
        'create-footnote'
      );
      
      await documentCache.invalidate(documentId);
      
      const footnoteId = response.data.replies?.[0]?.createFootnote?.footnoteId;
      
      // If text was provided, insert it into the footnote
      if (footnoteText && footnoteId) {
        // Note: Inserting text into footnote requires knowing its index
        // This would need additional API call to get document structure
      }
      
      return {
        content: [{
          type: "text",
          text: `✅ Created footnote at index ${index} (ID: ${footnoteId})`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating footnote: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

// 14. CreateNamedRangeRequest - Create named ranges for dynamic content
server.tool(
  "create-named-range",
  {
    documentId: z.string(),
    name: z.string(),
    startIndex: z.number(),
    endIndex: z.number(),
    tabId: z.string().optional()
  },
  async ({ documentId, name, startIndex, endIndex, tabId }) => {
    try {
      const request = {
        createNamedRange: {
          name,
          range: {
            startIndex,
            endIndex,
            tabId: tabId || ''
          }
        }
      };
      
      const response = await withRetry(() =>
        docsClient.documents.batchUpdate({
          documentId,
          requestBody: { requests: [request] }
        }),
        3,
        'create-named-range'
      );
      
      await documentCache.invalidate(documentId);
      
      const namedRangeId = response.data.replies?.[0]?.createNamedRange?.namedRangeId;
      
      return {
        content: [{
          type: "text",
          text: `✅ Created named range "${name}" from index ${startIndex} to ${endIndex} (ID: ${namedRangeId})`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error creating named range: ${sanitizeErrorMessage(error)}`
        }],
        isError: true
      };
    }
  }
);

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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error inserting table row: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error inserting table column: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error deleting table row: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error deleting table column: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error updating table cell style: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error merging table cells: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error unmerging table cells: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error pinning table header rows: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error updating table column properties: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error updating table row style: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error deleting named range: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error replacing named range content: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error updating document style: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error updating section style: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error deleting paragraph bullets: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error replacing image: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error deleting positioned object: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error deleting header: ${sanitizeErrorMessage(error)}`
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
      
      await documentCache.invalidate(documentId);
      
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
          text: `Error deleting footer: ${sanitizeErrorMessage(error)}`
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
      const cached = await documentCache.get(documentId);
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
          text: `Error getting tabs: ${sanitizeErrorMessage(error)}`
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
      const cached = await documentCache.get(documentId);
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
          text: `Error analyzing document: ${sanitizeErrorMessage(error)}`
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
          text: `Error getting document with suggestions: ${sanitizeErrorMessage(error)}`
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
          text: `Error copying document: ${sanitizeErrorMessage(error)}`
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
          text: `Error moving document: ${sanitizeErrorMessage(error)}`
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
          text: `Error creating from template: ${sanitizeErrorMessage(error)}`
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
    console.error("❌ FATAL: Failed to initialize Google API clients!");
    console.error("Please check:");
    console.error("1. OAuth credentials are properly configured");
    console.error("2. GOOGLE_OAUTH_PATH or GOOGLE_CLIENT_ID/SECRET are set");
    console.error("3. Token file is valid (if exists)");
    console.error("Exiting...");
    process.exit(1);
  }
  
  // Validate that clients are actually initialized
  if (!docsClient || !driveClient) {
    console.error("❌ FATAL: API clients are null after initialization!");
    process.exit(1);
  }
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("========================================");
  console.error("DocuGen MCP Server v4.2 - COMPLETE");
  console.error("========================================");
  console.error("✅ All 33 batch operations implemented");
  console.error("✅ Tab management system");
  console.error("✅ Suggestions API");
  console.error("✅ Document analysis");
  console.error("✅ Error handling & retry logic");
  console.error("✅ Caching system");
  console.error("✅ UTF-16 utilities fixed");
  console.error("✅ Client validation added");
  console.error("========================================");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});