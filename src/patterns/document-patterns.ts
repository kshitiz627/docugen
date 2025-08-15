/**
 * Smart Document Patterns for DocuGen
 * High-level operations for creating complete document sections
 */

export interface DocumentSection {
  type: 'header' | 'paragraph' | 'list' | 'table' | 'pageBreak';
  content: any;
  style?: any;
}

/**
 * Creates a professional document header with title, subtitle, and metadata
 */
export async function createDocumentHeader(
  docsClient: any,
  documentId: string,
  title: string,
  subtitle?: string,
  metadata?: { author?: string; date?: string; version?: string }
): Promise<{ success: boolean; hint: string }> {
  const requests = [];
  let currentIndex = 1; // Start at beginning of document
  
  // Add title
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: title + '\n'
    }
  });
  
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: currentIndex,
        endIndex: currentIndex + title.length
      },
      paragraphStyle: {
        namedStyleType: 'TITLE',
        alignment: 'CENTER',
        spaceAbove: { magnitude: 0, unit: 'PT' },
        spaceBelow: { magnitude: 12, unit: 'PT' }
      },
      fields: 'namedStyleType,alignment,spaceAbove,spaceBelow'
    }
  });
  
  currentIndex += title.length + 1;
  
  // Add subtitle if provided
  if (subtitle) {
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: subtitle + '\n'
      }
    });
    
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: currentIndex,
          endIndex: currentIndex + subtitle.length
        },
        paragraphStyle: {
          namedStyleType: 'SUBTITLE',
          alignment: 'CENTER',
          spaceBelow: { magnitude: 24, unit: 'PT' }
        },
        fields: 'namedStyleType,alignment,spaceBelow'
      }
    });
    
    currentIndex += subtitle.length + 1;
  }
  
  // Add metadata line if provided
  if (metadata && Object.keys(metadata).length > 0) {
    const metadataText = Object.entries(metadata)
      .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`)
      .join(' | ');
    
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: metadataText + '\n'
      }
    });
    
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: currentIndex,
          endIndex: currentIndex + metadataText.length
        },
        textStyle: {
          fontSize: { magnitude: 10, unit: 'PT' },
          foregroundColor: {
            color: {
              rgbColor: { red: 0.5, green: 0.5, blue: 0.5 }
            }
          },
          italic: true
        },
        fields: 'fontSize,foregroundColor,italic'
      }
    });
    
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: currentIndex,
          endIndex: currentIndex + metadataText.length
        },
        paragraphStyle: {
          alignment: 'CENTER',
          spaceBelow: { magnitude: 12, unit: 'PT' }
        },
        fields: 'alignment,spaceBelow'
      }
    });
    
    currentIndex += metadataText.length + 1;
  }
  
  // Add horizontal line
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: '\n'
    }
  });
  
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: currentIndex,
        endIndex: currentIndex + 1
      },
      paragraphStyle: {
        borderBottom: {
          color: {
            color: {
              rgbColor: { red: 0.8, green: 0.8, blue: 0.8 }
            }
          },
          width: { magnitude: 1, unit: 'PT' },
          dashStyle: 'SOLID'
        },
        spaceBelow: { magnitude: 24, unit: 'PT' }
      },
      fields: 'borderBottom,spaceBelow'
    }
  });
  
  // Sort and execute requests
  requests.sort((a, b) => {
    const getIndex = (req: any): number => {
      if (req.insertText?.location?.index) return req.insertText.location.index;
      return 0;
    };
    return getIndex(b) - getIndex(a);
  });
  
  await docsClient.documents.batchUpdate({
    documentId,
    requestBody: { requests }
  });
  
  return {
    success: true,
    hint: 'Professional header created with title, subtitle, metadata, and separator line'
  };
}

/**
 * Creates a formatted section with heading and content
 */
export async function createSection(
  docsClient: any,
  documentId: string,
  position: number | 'end',
  heading: string,
  content: string | string[],
  level: 1 | 2 | 3 | 4 | 5 | 6 = 2
): Promise<{ success: boolean; endIndex: number; hint: string }> {
  // Get document to find insertion point
  const doc = await docsClient.documents.get({ documentId });
  const insertIndex = position === 'end'
    ? doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1
    : position;
  
  const requests = [];
  let currentIndex = insertIndex;
  
  // Add heading
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: heading + '\n'
    }
  });
  
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: currentIndex,
        endIndex: currentIndex + heading.length
      },
      paragraphStyle: {
        namedStyleType: `HEADING_${level}`,
        spaceAbove: { magnitude: 12, unit: 'PT' },
        spaceBelow: { magnitude: 6, unit: 'PT' }
      },
      fields: 'namedStyleType,spaceAbove,spaceBelow'
    }
  });
  
  currentIndex += heading.length + 1;
  
  // Add content (handle array of paragraphs)
  const paragraphs = Array.isArray(content) ? content : [content];
  
  for (const paragraph of paragraphs) {
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: paragraph + '\n'
      }
    });
    
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: currentIndex,
          endIndex: currentIndex + paragraph.length
        },
        paragraphStyle: {
          namedStyleType: 'NORMAL_TEXT',
          spaceBelow: { magnitude: 8, unit: 'PT' }
        },
        fields: 'namedStyleType,spaceBelow'
      }
    });
    
    currentIndex += paragraph.length + 1;
  }
  
  // Sort and execute
  requests.sort((a, b) => {
    const getIndex = (req: any): number => {
      if (req.insertText?.location?.index) return req.insertText.location.index;
      return 0;
    };
    return getIndex(b) - getIndex(a);
  });
  
  await docsClient.documents.batchUpdate({
    documentId,
    requestBody: { requests }
  });
  
  return {
    success: true,
    endIndex: currentIndex,
    hint: `Section created with H${level} heading and ${paragraphs.length} paragraph(s)`
  };
}

/**
 * Creates a formatted list (bullet or numbered)
 */
export async function createFormattedList(
  docsClient: any,
  documentId: string,
  position: number | 'end',
  items: string[],
  type: 'BULLET' | 'NUMBERED' | 'CHECKLIST' = 'BULLET',
  title?: string
): Promise<{ success: boolean; endIndex: number; hint: string }> {
  const doc = await docsClient.documents.get({ documentId });
  const insertIndex = position === 'end'
    ? doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1
    : position;
  
  const requests = [];
  let currentIndex = insertIndex;
  
  // Add title if provided
  if (title) {
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: title + '\n'
      }
    });
    
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: currentIndex,
          endIndex: currentIndex + title.length
        },
        textStyle: {
          bold: true
        },
        fields: 'bold'
      }
    });
    
    currentIndex += title.length + 1;
  }
  
  // Add list items
  const listStartIndex = currentIndex;
  const listText = items.join('\n') + '\n';
  
  requests.push({
    insertText: {
      location: { index: currentIndex },
      text: listText
    }
  });
  
  // Create bullets/numbers for the list
  const bulletPreset = type === 'NUMBERED' 
    ? 'NUMBERED_DECIMAL_NESTED'
    : type === 'CHECKLIST'
    ? 'CHECKLIST'
    : 'BULLET_DISC_CIRCLE_SQUARE';
  
  requests.push({
    createParagraphBullets: {
      range: {
        startIndex: listStartIndex,
        endIndex: listStartIndex + listText.length - 1
      },
      bulletPreset: bulletPreset
    }
  });
  
  currentIndex += listText.length;
  
  // Sort and execute
  requests.sort((a, b) => {
    const getIndex = (req: any): number => {
      if (req.insertText?.location?.index) return req.insertText.location.index;
      return 0;
    };
    return getIndex(b) - getIndex(a);
  });
  
  await docsClient.documents.batchUpdate({
    documentId,
    requestBody: { requests }
  });
  
  return {
    success: true,
    endIndex: currentIndex,
    hint: `${type} list created with ${items.length} items${title ? ' and title' : ''}`
  };
}

/**
 * Creates a complete report structure
 */
export async function createReportStructure(
  docsClient: any,
  documentId: string,
  config: {
    title: string;
    subtitle?: string;
    author?: string;
    sections: Array<{
      heading: string;
      content: string | string[];
      includePageBreak?: boolean;
    }>;
    includeTableOfContents?: boolean;
  }
): Promise<{ success: boolean; structure: any; hint: string }> {
  const structure: any = {
    headerEnd: 0,
    sections: [],
    totalPages: 1
  };
  
  // Create header
  await createDocumentHeader(
    docsClient,
    documentId,
    config.title,
    config.subtitle,
    { author: config.author, date: new Date().toLocaleDateString() }
  );
  
  // Get current document state
  const doc = await docsClient.documents.get({ documentId });
  let currentIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;
  structure.headerEnd = currentIndex;
  
  // Add table of contents placeholder if requested
  if (config.includeTableOfContents) {
    const tocResult = await createSection(
      docsClient,
      documentId,
      currentIndex,
      'Table of Contents',
      config.sections.map((s, i) => `${i + 1}. ${s.heading}`).join('\n'),
      2
    );
    currentIndex = tocResult.endIndex;
    
    // Add page break after TOC
    await docsClient.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{
          insertPageBreak: {
            location: { index: currentIndex }
          }
        }]
      }
    });
    currentIndex += 1;
    structure.totalPages++;
  }
  
  // Add each section
  for (let i = 0; i < config.sections.length; i++) {
    const section = config.sections[i];
    if (!section) continue;
    
    const sectionResult = await createSection(
      docsClient,
      documentId,
      currentIndex,
      section.heading,
      section.content,
      2
    );
    
    structure.sections.push({
      heading: section.heading,
      startIndex: currentIndex,
      endIndex: sectionResult.endIndex
    });
    
    currentIndex = sectionResult.endIndex;
    
    // Add page break if requested
    if (section.includePageBreak && i < config.sections.length - 1) {
      await docsClient.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [{
            insertPageBreak: {
              location: { index: currentIndex }
            }
          }]
        }
      });
      currentIndex += 1;
      structure.totalPages++;
    }
  }
  
  return {
    success: true,
    structure,
    hint: `Complete report created with ${config.sections.length} sections across ${structure.totalPages} pages`
  };
}