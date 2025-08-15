// Incremental Document Building System for DocuGen
// This module provides session-based incremental document operations

import { docs_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";

interface DocumentSession {
  documentId: string;
  title: string;
  currentIndex: number;
  sections: Array<{
    type: string;
    startIndex: number;
    endIndex: number;
    metadata?: any;
  }>;
  createdAt: Date;
  lastModified: Date;
}

export class IncrementalDocumentBuilder {
  private sessions: Map<string, DocumentSession> = new Map();
  private docsClient: docs_v1.Docs;
  
  constructor(docsClient: docs_v1.Docs) {
    this.docsClient = docsClient;
  }
  
  // Create a new document session
  async createSession(title: string): Promise<DocumentSession> {
    const response = await this.docsClient.documents.create({
      requestBody: { title }
    });
    
    const documentId = response.data.documentId!;
    const session: DocumentSession = {
      documentId,
      title,
      currentIndex: 1,
      sections: [],
      createdAt: new Date(),
      lastModified: new Date()
    };
    
    this.sessions.set(documentId, session);
    return session;
  }
  
  // Get current document state
  async getDocumentState(documentId: string): Promise<{
    content: string;
    currentIndex: number;
    sections: DocumentSession['sections'];
  }> {
    const session = this.sessions.get(documentId);
    if (!session) {
      throw new Error(`No active session for document ${documentId}`);
    }
    
    const doc = await this.docsClient.documents.get({ documentId });
    let content = '';
    
    if (doc.data.body?.content) {
      doc.data.body.content.forEach((element: any) => {
        if (element.paragraph?.elements) {
          element.paragraph.elements.forEach((elem: any) => {
            if (elem.textRun?.content) {
              content += elem.textRun.content;
            }
          });
        }
      });
    }
    
    return {
      content,
      currentIndex: session.currentIndex,
      sections: session.sections
    };
  }
  
  // Add text to document
  async addText(documentId: string, text: string, formatting?: any): Promise<void> {
    const session = this.sessions.get(documentId);
    if (!session) {
      throw new Error(`No active session for document ${documentId}`);
    }
    
    const startIndex = session.currentIndex;
    const requests: any[] = [{
      insertText: {
        location: { index: startIndex },
        text
      }
    }];
    
    // Apply formatting if provided
    if (formatting) {
      const endIndex = startIndex + text.length;
      const textStyle: any = {};
      const fields: string[] = [];
      
      if (formatting.bold !== undefined) {
        textStyle.bold = formatting.bold;
        fields.push('bold');
      }
      if (formatting.italic !== undefined) {
        textStyle.italic = formatting.italic;
        fields.push('italic');
      }
      if (formatting.underline !== undefined) {
        textStyle.underline = formatting.underline;
        fields.push('underline');
      }
      if (formatting.fontSize !== undefined) {
        textStyle.fontSize = { magnitude: formatting.fontSize, unit: 'PT' };
        fields.push('fontSize');
      }
      
      if (fields.length > 0) {
        requests.push({
          updateTextStyle: {
            range: { startIndex, endIndex },
            textStyle,
            fields: fields.join(',')
          }
        });
      }
    }
    
    await this.docsClient.documents.batchUpdate({
      documentId,
      requestBody: { requests }
    });
    
    // Update session
    session.currentIndex += text.length;
    session.sections.push({
      type: 'text',
      startIndex,
      endIndex: session.currentIndex,
      metadata: formatting
    });
    session.lastModified = new Date();
  }
  
  // Add heading
  async addHeading(documentId: string, text: string, level: number = 1): Promise<void> {
    const session = this.sessions.get(documentId);
    if (!session) {
      throw new Error(`No active session for document ${documentId}`);
    }
    
    const headingText = text + '\n';
    const startIndex = session.currentIndex;
    
    const headingType = level === 1 ? 'HEADING_1' : 
                       level === 2 ? 'HEADING_2' : 
                       level === 3 ? 'HEADING_3' : 'NORMAL';
    
    const requests = [
      {
        insertText: {
          location: { index: startIndex },
          text: headingText
        }
      },
      {
        updateParagraphStyle: {
          range: {
            startIndex,
            endIndex: startIndex + headingText.length
          },
          paragraphStyle: {
            namedStyleType: headingType
          },
          fields: 'namedStyleType'
        }
      }
    ];
    
    await this.docsClient.documents.batchUpdate({
      documentId,
      requestBody: { requests }
    });
    
    // Update session
    session.currentIndex += headingText.length;
    session.sections.push({
      type: 'heading',
      startIndex,
      endIndex: session.currentIndex,
      metadata: { level }
    });
    session.lastModified = new Date();
  }
  
  // Add list (bullet or numbered)
  async addList(documentId: string, items: string[], numbered: boolean = false): Promise<void> {
    const session = this.sessions.get(documentId);
    if (!session) {
      throw new Error(`No active session for document ${documentId}`);
    }
    
    const startIndex = session.currentIndex;
    const listText = items.join('\n') + '\n';
    
    const requests = [
      {
        insertText: {
          location: { index: startIndex },
          text: listText
        }
      },
      {
        createParagraphBullets: {
          range: {
            startIndex,
            endIndex: startIndex + listText.length
          },
          bulletPreset: numbered ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE'
        }
      }
    ];
    
    await this.docsClient.documents.batchUpdate({
      documentId,
      requestBody: { requests }
    });
    
    // Update session
    session.currentIndex += listText.length;
    session.sections.push({
      type: numbered ? 'numbered_list' : 'bullet_list',
      startIndex,
      endIndex: session.currentIndex,
      metadata: { items }
    });
    session.lastModified = new Date();
  }
  
  // Add table at the end of document (safer approach)
  async addTable(documentId: string, rows: string[][], label?: string): Promise<void> {
    const session = this.sessions.get(documentId);
    if (!session) {
      throw new Error(`No active session for document ${documentId}`);
    }
    
    // First, add a label if provided
    if (label) {
      await this.addText(documentId, `\n${label}\n`, { bold: true });
    }
    
    // Get the latest document state to ensure we have the correct end index
    const doc = await this.docsClient.documents.get({ documentId });
    const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex || 1;
    
    // Create table at the end
    const requests: any[] = [
      {
        insertTable: {
          rows: rows.length,
          columns: rows[0]?.length || 1,
          location: { index: endIndex - 1 }
        }
      }
    ];
    
    // Populate table cells
    const cellsRequests: any[] = [];
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      for (let colIndex = 0; colIndex < rows[rowIndex].length; colIndex++) {
        const cellText = rows[rowIndex][colIndex];
        if (cellText) {
          // Calculate cell index using the correct formula
          const cellIndex = endIndex + 3 + (rowIndex * 5) + (colIndex * 2);
          cellsRequests.push({
            insertText: {
              location: { index: cellIndex },
              text: cellText
            }
          });
        }
      }
    }
    
    // Execute table creation first, then populate cells
    await this.docsClient.documents.batchUpdate({
      documentId,
      requestBody: { requests }
    });
    
    // Then populate the cells if we have content
    if (cellsRequests.length > 0) {
      await this.docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests: cellsRequests }
      });
    }
    
    // Update session
    const tableSize = 4 + (rows.length * 5) + (rows[0].length * 2);
    session.currentIndex = endIndex + tableSize;
    session.sections.push({
      type: 'table',
      startIndex: endIndex - 1,
      endIndex: session.currentIndex,
      metadata: { rows, label }
    });
    session.lastModified = new Date();
  }
  
  // Clear session
  clearSession(documentId: string): void {
    this.sessions.delete(documentId);
  }
  
  // Get all active sessions
  getActiveSessions(): Array<{ documentId: string; title: string; lastModified: Date }> {
    return Array.from(this.sessions.values()).map(session => ({
      documentId: session.documentId,
      title: session.title,
      lastModified: session.lastModified
    }));
  }
  
  // Check if session exists
  hasSession(documentId: string): boolean {
    return this.sessions.has(documentId);
  }
}