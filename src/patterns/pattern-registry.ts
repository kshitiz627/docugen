/**
 * Pattern Registry for DocuGen
 * Provides examples and guidance for common document operations
 */

export interface PatternExample {
  name: string;
  description: string;
  category: 'table' | 'formatting' | 'structure' | 'list' | 'image';
  difficulty: 'easy' | 'medium' | 'hard';
  steps: Array<{
    description: string;
    code: string;
    note?: string;
  }>;
  commonMistakes: string[];
  tips: string[];
  visualExample?: string;
}

export const PATTERN_REGISTRY: PatternExample[] = [
  {
    name: 'professional-data-table',
    description: 'Create a professional table with styled headers and data',
    category: 'table',
    difficulty: 'easy',
    steps: [
      {
        description: 'Use the high-level createFormattedTable function',
        code: `await createFormattedTable(docsClient, documentId, 'end', {
  headers: ['Product', 'Q1 Sales', 'Q2 Sales', 'Q3 Sales'],
  rows: [
    ['Widget A', '$10,000', '$12,000', '$15,000'],
    ['Widget B', '$8,000', '$9,500', '$11,000'],
    ['Widget C', '$5,000', '$7,000', '$9,000']
  ],
  style: 'professional'
})`,
        note: 'This handles all index calculations automatically'
      }
    ],
    commonMistakes: [
      'Trying to insert text into cells before creating the table',
      'Using wrong indices for cell positions',
      'Forgetting that each cell adds ~3 to the index count'
    ],
    tips: [
      'Always create the table structure first',
      'Use the returned cellMap to reference specific cells',
      'Apply formatting after content is inserted'
    ],
    visualExample: `
┌──────────┬──────────┬──────────┬──────────┐
│ Product  │ Q1 Sales │ Q2 Sales │ Q3 Sales │ (Blue background, white text)
├──────────┼──────────┼──────────┼──────────┤
│ Widget A │ $10,000  │ $12,000  │ $15,000  │
│ Widget B │ $8,000   │ $9,500   │ $11,000  │
│ Widget C │ $5,000   │ $7,000   │ $9,000   │
└──────────┴──────────┴──────────┴──────────┘`
  },
  
  {
    name: 'manual-table-creation',
    description: 'Manually create a table with precise control (advanced)',
    category: 'table',
    difficulty: 'hard',
    steps: [
      {
        description: 'Step 1: Insert the table structure',
        code: `await batchUpdate({
  requests: [{
    insertTable: {
      location: { index: 100 },
      rows: 3,
      columns: 2
    }
  }]
})`,
        note: 'Table is inserted at index 100'
      },
      {
        description: 'Step 2: Calculate cell positions',
        code: `// First cell: tableIndex + 4
// Subsequent cells: previous + 3
const cellIndices = {
  '0,0': 104,  // First cell
  '0,1': 107,  // Second cell in first row
  '1,0': 110,  // First cell in second row
  '1,1': 113,  // And so on...
}`,
        note: 'CRITICAL: These indices shift if content is added!'
      },
      {
        description: 'Step 3: Insert content (MUST be in reverse order)',
        code: `const requests = [
  { insertText: { location: { index: 113 }, text: 'Cell 1,1' }},
  { insertText: { location: { index: 110 }, text: 'Cell 1,0' }},
  { insertText: { location: { index: 107 }, text: 'Cell 0,1' }},
  { insertText: { location: { index: 104 }, text: 'Cell 0,0' }}
]`,
        note: 'Highest index first prevents shifting'
      }
    ],
    commonMistakes: [
      'Inserting in forward order (causes index shifting)',
      'Using wrong base index for first cell',
      'Not accounting for paragraph marks between cells'
    ],
    tips: [
      'ALWAYS insert from highest to lowest index',
      'Use get-document to verify table structure',
      'Consider using high-level patterns instead'
    ]
  },
  
  {
    name: 'formatted-report-header',
    description: 'Create a professional report header with title and metadata',
    category: 'structure',
    difficulty: 'easy',
    steps: [
      {
        description: 'Use the createDocumentHeader pattern',
        code: `await createDocumentHeader(docsClient, documentId,
  'Q4 2024 Sales Report',
  'Confidential - Internal Use Only',
  {
    author: 'Sales Team',
    date: '2024-12-15',
    version: 'v1.0'
  }
)`,
        note: 'Creates centered title, subtitle, and metadata line with separator'
      }
    ],
    commonMistakes: [
      'Trying to center text without using paragraph alignment',
      'Forgetting to set spacing between elements'
    ],
    tips: [
      'Use named styles (TITLE, SUBTITLE) for consistency',
      'Add borders for visual separation',
      'Set appropriate spacing above/below elements'
    ],
    visualExample: `
                    Q4 2024 Sales Report
                         (Title style, centered)
                    
              Confidential - Internal Use Only
                    (Subtitle style, centered)
                    
        Author: Sales Team | Date: 2024-12-15 | Version: v1.0
                    (Italic, gray, centered)
    ────────────────────────────────────────────────────────────`
  },
  
  {
    name: 'nested-bullet-list',
    description: 'Create a multi-level bullet list',
    category: 'list',
    difficulty: 'medium',
    steps: [
      {
        description: 'Insert list text with tabs for nesting',
        code: `const listText = \`Main Point 1
\\tSub-point 1.1
\\tSub-point 1.2
\\t\\tDetail 1.2.1
Main Point 2
\\tSub-point 2.1\`;

await insertText({ index: 100, text: listText })`,
        note: 'Use \\t for each level of nesting'
      },
      {
        description: 'Apply bullet formatting',
        code: `await createParagraphBullets({
  range: { startIndex: 100, endIndex: 100 + listText.length },
  bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
})`,
        note: 'Different bullet styles per level'
      }
    ],
    commonMistakes: [
      'Using spaces instead of tabs for nesting',
      'Applying bullets before inserting text',
      'Wrong range for bullet application'
    ],
    tips: [
      'Use \\t (tab) for nesting, not spaces',
      'Apply bullets AFTER text insertion',
      'Different presets give different bullet styles'
    ],
    visualExample: `
• Main Point 1
  ○ Sub-point 1.1
  ○ Sub-point 1.2
    ▪ Detail 1.2.1
• Main Point 2
  ○ Sub-point 2.1`
  },
  
  {
    name: 'inline-image-with-caption',
    description: 'Insert an image with a centered caption',
    category: 'image',
    difficulty: 'medium',
    steps: [
      {
        description: 'Insert the image',
        code: `await insertInlineImage({
  location: { index: 100 },
  uri: 'https://example.com/chart.png',
  width: { magnitude: 400, unit: 'PT' },
  height: { magnitude: 300, unit: 'PT' }
})`,
        note: 'Image inherits paragraph alignment'
      },
      {
        description: 'Center the image paragraph',
        code: `await updateParagraphStyle({
  range: { startIndex: 100, endIndex: 101 },
  paragraphStyle: { alignment: 'CENTER' },
  fields: 'alignment'
})`
      },
      {
        description: 'Add caption below',
        code: `await insertText({
  location: { index: 102 },
  text: 'Figure 1: Sales Growth Chart'
})

await updateTextStyle({
  range: { startIndex: 102, endIndex: 132 },
  textStyle: { 
    italic: true,
    fontSize: { magnitude: 10, unit: 'PT' }
  },
  fields: 'italic,fontSize'
})`
      }
    ],
    commonMistakes: [
      'Trying to center image directly (must center paragraph)',
      'Wrong index calculation after image insertion',
      'Forgetting images are inline objects'
    ],
    tips: [
      'Images are inline - center the paragraph',
      'Images add 1 to the index count',
      'Use consistent caption formatting'
    ]
  },
  
  {
    name: 'complete-report-generation',
    description: 'Generate a complete multi-section report',
    category: 'structure',
    difficulty: 'easy',
    steps: [
      {
        description: 'Use createReportStructure for complete reports',
        code: `await createReportStructure(docsClient, documentId, {
  title: 'Annual Business Report',
  subtitle: '2024 Performance Analysis',
  author: 'Analytics Team',
  includeTableOfContents: true,
  sections: [
    {
      heading: 'Executive Summary',
      content: 'This year showed strong growth...',
      includePageBreak: true
    },
    {
      heading: 'Financial Performance',
      content: [
        'Revenue increased by 25%...',
        'Profit margins improved to 18%...'
      ]
    },
    {
      heading: 'Market Analysis',
      content: 'Market share grew to 15%...'
    }
  ]
})`,
        note: 'Handles all formatting and structure automatically'
      }
    ],
    commonMistakes: [],
    tips: [
      'Let the pattern handle page breaks',
      'Use arrays for multi-paragraph sections',
      'TOC is automatically generated from sections'
    ]
  }
];

/**
 * Get patterns by category
 */
export function getPatternsByCategory(category: string): PatternExample[] {
  return PATTERN_REGISTRY.filter(p => p.category === category);
}

/**
 * Get pattern by name
 */
export function getPattern(name: string): PatternExample | undefined {
  return PATTERN_REGISTRY.find(p => p.name === name);
}

/**
 * Get all tips for a category
 */
export function getTipsForCategory(category: string): string[] {
  const patterns = getPatternsByCategory(category);
  const tips = new Set<string>();
  patterns.forEach(p => p.tips.forEach(tip => tips.add(tip)));
  return Array.from(tips);
}

/**
 * Get common mistakes to avoid
 */
export function getCommonMistakes(): string[] {
  const mistakes = new Set<string>();
  PATTERN_REGISTRY.forEach(p => 
    p.commonMistakes.forEach(mistake => mistakes.add(mistake))
  );
  return Array.from(mistakes);
}

/**
 * Generate help text for a specific operation
 */
export function getOperationHelp(operation: string): string {
  const relevantPatterns = PATTERN_REGISTRY.filter(p => 
    p.steps.some(s => s.code.includes(operation))
  );
  
  if (relevantPatterns.length === 0) {
    return `No specific patterns found for ${operation}. Check the pattern registry for examples.`;
  }
  
  let help = `Examples using ${operation}:\n\n`;
  
  relevantPatterns.forEach(pattern => {
    help += `📘 ${pattern.name} (${pattern.difficulty})\n`;
    help += `   ${pattern.description}\n`;
    
    const relevantSteps = pattern.steps.filter(s => s.code.includes(operation));
    relevantSteps.forEach(step => {
      help += `   - ${step.description}\n`;
      if (step.note) {
        help += `     ⚠️ ${step.note}\n`;
      }
    });
    
    if (pattern.tips.length > 0) {
      help += `   💡 Tips: ${pattern.tips[0]}\n`;
    }
    
    help += '\n';
  });
  
  return help;
}