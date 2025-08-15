// Markdown to Google Docs converter
// Supports GitHub-flavored markdown with tables

import { docs_v1 } from "googleapis";

interface MarkdownSection {
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'table' | 'blockquote' | 'hr';
  content?: string;
  level?: number;
  items?: string[];
  rows?: string[][];
  ordered?: boolean;
}

export class MarkdownToDocsConverter {
  private docsClient: docs_v1.Docs;
  
  constructor(docsClient: docs_v1.Docs) {
    this.docsClient = docsClient;
  }
  
  // Parse markdown into sections
  parseMarkdown(markdown: string): MarkdownSection[] {
    const lines = markdown.split('\n');
    const sections: MarkdownSection[] = [];
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      // Headings
      if (line.match(/^#{1,6}\s/)) {
        const level = line.match(/^#+/)![0].length;
        const content = line.replace(/^#+\s+/, '').trim();
        sections.push({ type: 'heading', content, level });
        i++;
        continue;
      }
      
      // Horizontal rule
      if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
        sections.push({ type: 'hr' });
        i++;
        continue;
      }
      
      // Code block
      if (line.startsWith('```')) {
        const codeLines: string[] = [];
        i++; // Skip opening ```
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // Skip closing ```
        sections.push({ 
          type: 'code', 
          content: codeLines.join('\n') 
        });
        continue;
      }
      
      // Table (GitHub-style)
      if (line.includes('|') && i + 1 < lines.length && lines[i + 1].match(/^\|?[\s\-:|]+\|/)) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].includes('|')) {
          tableLines.push(lines[i]);
          i++;
        }
        const rows = this.parseTable(tableLines);
        if (rows.length > 0) {
          sections.push({ type: 'table', rows });
        }
        continue;
      }
      
      // Blockquote
      if (line.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && lines[i].startsWith('>')) {
          quoteLines.push(lines[i].replace(/^>\s*/, ''));
          i++;
        }
        sections.push({ 
          type: 'blockquote', 
          content: quoteLines.join('\n') 
        });
        continue;
      }
      
      // Lists
      if (line.match(/^[\s]*[-*+]\s/) || line.match(/^[\s]*\d+\.\s/)) {
        const listItems: string[] = [];
        const ordered = !!line.match(/^[\s]*\d+\.\s/);
        const indent = line.match(/^[\s]*/)?.[0].length || 0;
        
        while (i < lines.length) {
          const currentLine = lines[i];
          const currentIndent = currentLine.match(/^[\s]*/)?.[0].length || 0;
          
          if (ordered && currentLine.match(/^[\s]*\d+\.\s/)) {
            listItems.push(currentLine.replace(/^[\s]*\d+\.\s+/, '').trim());
            i++;
          } else if (!ordered && currentLine.match(/^[\s]*[-*+]\s/)) {
            listItems.push(currentLine.replace(/^[\s]*[-*+]\s+/, '').trim());
            i++;
          } else if (currentIndent > indent && currentLine.trim()) {
            // Continuation of previous item
            if (listItems.length > 0) {
              listItems[listItems.length - 1] += ' ' + currentLine.trim();
            }
            i++;
          } else {
            break;
          }
        }
        
        if (listItems.length > 0) {
          sections.push({ type: 'list', items: listItems, ordered });
        }
        continue;
      }
      
      // Paragraph
      if (line.trim()) {
        const paragraphLines: string[] = [];
        while (i < lines.length && lines[i].trim() && 
               !lines[i].match(/^#{1,6}\s/) && 
               !lines[i].match(/^[-*+]\s/) &&
               !lines[i].match(/^\d+\.\s/) &&
               !lines[i].startsWith('>') &&
               !lines[i].startsWith('```') &&
               !lines[i].includes('|')) {
          paragraphLines.push(lines[i]);
          i++;
        }
        sections.push({ 
          type: 'paragraph', 
          content: paragraphLines.join(' ').trim() 
        });
        continue;
      }
      
      i++;
    }
    
    return sections;
  }
  
  // Parse markdown table
  private parseTable(lines: string[]): string[][] {
    const rows: string[][] = [];
    
    for (let i = 0; i < lines.length; i++) {
      // Skip separator line
      if (lines[i].match(/^\|?[\s\-:|]+\|/)) continue;
      
      const cells = lines[i]
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== '');
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    
    return rows;
  }
  
  // Convert markdown to Google Docs
  async createFromMarkdown(title: string, markdown: string): Promise<string> {
    // Create document
    const createResponse = await this.docsClient.documents.create({
      requestBody: { title }
    });
    
    const documentId = createResponse.data.documentId!;
    const sections = this.parseMarkdown(markdown);
    
    // Build requests
    const requests: any[] = [];
    let currentIndex = 1;
    
    for (const section of sections) {
      switch (section.type) {
        case 'heading':
          const headingText = section.content + '\n';
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: headingText
            }
          });
          
          const headingType = section.level === 1 ? 'HEADING_1' :
                            section.level === 2 ? 'HEADING_2' :
                            section.level === 3 ? 'HEADING_3' :
                            section.level === 4 ? 'HEADING_4' :
                            section.level === 5 ? 'HEADING_5' :
                            'HEADING_6';
          
          requests.push({
            updateParagraphStyle: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + headingText.length
              },
              paragraphStyle: { namedStyleType: headingType },
              fields: 'namedStyleType'
            }
          });
          
          currentIndex += headingText.length;
          break;
          
        case 'paragraph':
          const paragraphText = section.content + '\n\n';
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: paragraphText
            }
          });
          currentIndex += paragraphText.length;
          break;
          
        case 'code':
          const codeText = section.content + '\n\n';
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: codeText
            }
          });
          
          // Apply monospace font
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + codeText.length - 2
              },
              textStyle: {
                weightedFontFamily: {
                  fontFamily: 'Courier New'
                },
                backgroundColor: {
                  color: {
                    rgbColor: { red: 0.95, green: 0.95, blue: 0.95 }
                  }
                }
              },
              fields: 'weightedFontFamily,backgroundColor'
            }
          });
          
          currentIndex += codeText.length;
          break;
          
        case 'list':
          const listText = section.items!.join('\n') + '\n\n';
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: listText
            }
          });
          
          requests.push({
            createParagraphBullets: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + listText.length - 2
              },
              bulletPreset: section.ordered ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE'
            }
          });
          
          currentIndex += listText.length;
          break;
          
        case 'blockquote':
          const quoteText = '❝ ' + section.content + ' ❞\n\n';
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: quoteText
            }
          });
          
          // Style blockquote
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + quoteText.length - 2
              },
              textStyle: {
                italic: true,
                foregroundColor: {
                  color: {
                    rgbColor: { red: 0.4, green: 0.4, blue: 0.4 }
                  }
                }
              },
              fields: 'italic,foregroundColor'
            }
          });
          
          currentIndex += quoteText.length;
          break;
          
        case 'hr':
          const hrText = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: hrText
            }
          });
          currentIndex += hrText.length;
          break;
          
        case 'table':
          // Format table as text with borders
          const rows = section.rows!;
          const colWidths = this.calculateColumnWidths(rows);
          let tableText = '\n';
          
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowText = row.map((cell, j) => cell.padEnd(colWidths[j])).join(' │ ');
            tableText += rowText + '\n';
            
            // Add separator after header
            if (i === 0) {
              const separator = colWidths.map(w => '─'.repeat(w)).join('─┼─');
              tableText += separator + '\n';
            }
          }
          tableText += '\n';
          
          requests.push({
            insertText: {
              location: { index: currentIndex },
              text: tableText
            }
          });
          
          // Apply monospace font to table
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: currentIndex,
                endIndex: currentIndex + tableText.length
              },
              textStyle: {
                weightedFontFamily: {
                  fontFamily: 'Courier New'
                }
              },
              fields: 'weightedFontFamily'
            }
          });
          
          currentIndex += tableText.length;
          break;
      }
    }
    
    // Apply all formatting
    if (requests.length > 0) {
      await this.docsClient.documents.batchUpdate({
        documentId,
        requestBody: { requests }
      });
    }
    
    return documentId;
  }
  
  // Calculate column widths for table formatting
  private calculateColumnWidths(rows: string[][]): number[] {
    if (rows.length === 0) return [];
    
    const widths: number[] = new Array(rows[0].length).fill(0);
    
    for (const row of rows) {
      for (let i = 0; i < row.length; i++) {
        widths[i] = Math.max(widths[i], row[i].length);
      }
    }
    
    return widths;
  }
  
  // Process inline formatting (bold, italic, code)
  processInlineFormatting(text: string): Array<{text: string, bold?: boolean, italic?: boolean, code?: boolean}> {
    const segments: Array<{text: string, bold?: boolean, italic?: boolean, code?: boolean}> = [];
    
    // This is simplified - a full implementation would need proper parsing
    // For now, we'll return the text as-is
    segments.push({ text });
    
    return segments;
  }
}