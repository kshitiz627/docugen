/**
 * Validation utilities for DocuGen
 * Provides input validation and sanitization functions
 */

import { DocGenError } from './errors.js';

export function validateIndex(index: number, maxIndex: number, operation: string): void {
  if (index < 1 || index > maxIndex) {
    throw new DocGenError(
      `Invalid index ${index} for ${operation}. Must be between 1 and ${maxIndex}`,
      'INVALID_INDEX',
      false,
      { index, maxIndex, operation }
    );
  }
}

export async function validateTabId(documentId: string, tabId: string | undefined): Promise<boolean> {
  if (!tabId || tabId === '') {
    return true; // Empty tab ID is valid (uses default tab)
  }
  
  try {
    // In a real implementation, this would check if the tab exists in the document
    // For now, we assume all non-empty tab IDs are valid
    return true;
  } catch (error) {
    console.error(`Failed to validate tab ID ${tabId} for document ${documentId}:`, error);
    return false;
  }
}

export function validateDocumentId(documentId: string): void {
  // Google Docs IDs are typically 44 characters long and alphanumeric with hyphens/underscores
  const docIdPattern = /^[a-zA-Z0-9_-]{10,}$/;
  if (!docIdPattern.test(documentId)) {
    throw new DocGenError(
      `Invalid document ID format: ${documentId}`,
      'INVALID_DOCUMENT_ID',
      false,
      { documentId }
    );
  }
}

export function sanitizeInput(input: string): string {
  // Remove null bytes and control characters except newlines and tabs
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

export function sortRequestsDescending(requests: any[]): any[] {
  const getIndex = (req: any): number => {
    // Extract index from various request types
    if (req.insertText?.location?.index !== undefined) return req.insertText.location.index;
    if (req.deleteContentRange?.range?.startIndex !== undefined) return req.deleteContentRange.range.startIndex;
    if (req.updateTextStyle?.range?.startIndex !== undefined) return req.updateTextStyle.range.startIndex;
    if (req.updateParagraphStyle?.range?.startIndex !== undefined) return req.updateParagraphStyle.range.startIndex;
    if (req.insertTable?.location?.index !== undefined) return req.insertTable.location.index;
    if (req.insertInlineImage?.location?.index !== undefined) return req.insertInlineImage.location.index;
    if (req.insertPageBreak?.location?.index !== undefined) return req.insertPageBreak.location.index;
    if (req.insertSectionBreak?.location?.index !== undefined) return req.insertSectionBreak.location.index;
    if (req.createParagraphBullets?.range?.startIndex !== undefined) return req.createParagraphBullets.range.startIndex;
    if (req.deleteParagraphBullets?.range?.startIndex !== undefined) return req.deleteParagraphBullets.range.startIndex;
    if (req.createNamedRange?.range?.startIndex !== undefined) return req.createNamedRange.range.startIndex;
    if (req.replaceNamedRangeContent?.text !== undefined) return 0; // Named range operations don't need sorting
    if (req.deleteNamedRange?.namedRangeId !== undefined) return 0;
    if (req.updateDocumentStyle !== undefined) return 0; // Document-level operations don't need sorting
    return 0;
  };
  
  return requests.sort((a, b) => getIndex(b) - getIndex(a));
}