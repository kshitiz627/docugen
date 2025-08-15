/**
 * Smart Table Patterns for DocuGen
 * High-level operations that handle complex table creation with proper formatting
 */

export interface TableData {
  headers: string[];
  rows: string[][];
  style?: 'professional' | 'simple' | 'striped' | 'minimal';
}

export interface TableResult {
  documentId: string;
  tableLocation: {
    startIndex: number;
    endIndex: number;
  };
  cellMap: {
    [key: string]: number; // e.g., "0,0" -> index
  };
  hint: string;
  example: string;
}

/**
 * Creates a complete formatted table with data in one operation
 * Handles all the complex index calculations internally
 */
export async function createFormattedTable(
  docsClient: any,
  documentId: string,
  position: number | 'end',
  data: TableData
): Promise<TableResult> {
  const rows = data.rows.length + 1; // +1 for header
  const columns = data.headers.length;
  
  // Get document to find insertion point
  const doc = await docsClient.documents.get({ documentId });
  const insertIndex = position === 'end' 
    ? doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1
    : position;
  
  // Step 1: Create the table structure
  const requests: any[] = [
    {
      insertTable: {
        location: { index: insertIndex },
        rows: rows,
        columns: columns
      }
    }
  ];
  
  // Step 2: Calculate cell indices (each cell is typically +3 from previous)
  const cellMap: { [key: string]: number } = {};
  let currentIndex = insertIndex + 4; // First cell starts at table_index + 4
  
  // Add headers
  for (let col = 0; col < columns; col++) {
    cellMap[`0,${col}`] = currentIndex;
    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: data.headers[col] || ''
      }
    });
    currentIndex += 3; // Move to next cell
  }
  
  // Add data rows
  for (let row = 0; row < data.rows.length; row++) {
    for (let col = 0; col < columns; col++) {
      const cellKey = `${row + 1},${col}`;
      cellMap[cellKey] = currentIndex;
      const rowData = data.rows[row];
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: rowData ? (rowData[col] || '') : ''
        }
      });
      currentIndex += 3;
    }
  }
  
  // Step 3: Apply styling based on style preference
  if (data.style === 'professional') {
    // Style header row
    requests.push({
      updateTableRowStyle: {
        tableStartLocation: { index: insertIndex },
        rowIndices: [0],
        tableRowStyle: {
          backgroundColor: {
            color: {
              rgbColor: {
                blue: 0.9529412,
                green: 0.52156866,
                red: 0.25882354
              }
            }
          }
        }
      }
    });
    
    // Make header text bold and white
    for (let col = 0; col < columns; col++) {
      const headerText = data.headers[col];
      if (headerText) {
        requests.push({
          updateTextStyle: {
            range: {
              startIndex: cellMap[`0,${col}`] || 0,
              endIndex: (cellMap[`0,${col}`] || 0) + headerText.length
            },
            textStyle: {
              bold: true,
              foregroundColor: {
                color: {
                  rgbColor: {
                    red: 1,
                    green: 1,
                    blue: 1
                  }
                }
              }
            },
            fields: 'bold,foregroundColor'
          }
        });
      }
    }
  } else if (data.style === 'striped') {
    // Alternate row colors
    for (let row = 0; row < data.rows.length; row += 2) {
      requests.push({
        updateTableRowStyle: {
          tableStartLocation: { index: insertIndex },
          rowIndices: [row + 1], // +1 to skip header
          tableRowStyle: {
            backgroundColor: {
              color: {
                rgbColor: {
                  red: 0.95,
                  green: 0.95,
                  blue: 0.95
                }
              }
            }
          }
        }
      });
    }
  }
  
  // Execute all operations in reverse order (highest index first)
  requests.sort((a, b) => {
    const getIndex = (req: any): number => {
      if (req.insertText?.location?.index) return req.insertText.location.index;
      if (req.insertTable?.location?.index) return req.insertTable.location.index;
      return 0;
    };
    return getIndex(b) - getIndex(a);
  });
  
  await docsClient.documents.batchUpdate({
    documentId,
    requestBody: { requests }
  });
  
  return {
    documentId,
    tableLocation: {
      startIndex: insertIndex,
      endIndex: currentIndex
    },
    cellMap,
    hint: `Table created with ${rows} rows and ${columns} columns. Headers are styled.`,
    example: `To update cell [1,1]: updateText({ index: ${cellMap['1,1'] || 0}, text: 'New Value' })`
  };
}

/**
 * Pattern for creating a comparison table
 */
export async function createComparisonTable(
  docsClient: any,
  documentId: string,
  position: number | 'end',
  title: string,
  items: string[],
  attributes: string[],
  data: { [item: string]: { [attribute: string]: string } }
): Promise<TableResult> {
  // First, insert the title
  const doc = await docsClient.documents.get({ documentId });
  const insertIndex = position === 'end'
    ? doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1
    : position;
    
  const titleRequests = [
    {
      insertText: {
        location: { index: insertIndex },
        text: title + '\n'
      }
    },
    {
      updateParagraphStyle: {
        range: {
          startIndex: insertIndex,
          endIndex: insertIndex + title.length
        },
        paragraphStyle: {
          namedStyleType: 'HEADING_2'
        },
        fields: 'namedStyleType'
      }
    }
  ];
  
  // Execute title insertion first
  await docsClient.documents.batchUpdate({
    documentId,
    requestBody: { requests: titleRequests }
  });
  
  // Create table data structure
  const headers = ['', ...items]; // Empty first cell for attribute names
  const rows = attributes.map(attr => [
    attr,
    ...items.map(item => data[item]?.[attr] || '-')
  ]);
  
  // Use our formatted table creator
  const tableData: TableData = {
    headers,
    rows,
    style: 'professional'
  };
  
  // Create the table after the title
  return createFormattedTable(
    docsClient,
    documentId,
    insertIndex + title.length + 1,
    tableData
  );
}

/**
 * Pattern for creating a data report table with totals
 */
export async function createDataTableWithTotals(
  docsClient: any,
  documentId: string,
  position: number | 'end',
  _title: string,
  headers: string[],
  data: (string | number)[][],
  totalColumns: number[] // Which columns to sum
): Promise<TableResult> {
  // Calculate totals
  const totals = new Array(headers.length).fill('');
  totals[0] = 'Total'; // First column label
  
  totalColumns.forEach(colIndex => {
    let sum = 0;
    data.forEach(row => {
      const value = row[colIndex];
      if (typeof value === 'number') {
        sum += value;
      } else if (typeof value === 'string') {
        const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
        if (!isNaN(num)) sum += num;
      }
    });
    totals[colIndex] = sum.toLocaleString();
  });
  
  // Add totals row to data
  const dataWithTotals = [...data.map(row => row.map(String)), totals];
  
  // Create the formatted table
  const result = await createFormattedTable(
    docsClient,
    documentId,
    position,
    {
      headers: headers,
      rows: dataWithTotals,
      style: 'professional'
    }
  );
  
  // Additional formatting for totals row
  const totalRowIndex = dataWithTotals.length; // Last row
  const totalRequests: any[] = [
    {
      updateTableRowStyle: {
        tableStartLocation: { index: result.tableLocation.startIndex },
        rowIndices: [totalRowIndex],
        tableRowStyle: {
          backgroundColor: {
            color: {
              rgbColor: {
                red: 0.9,
                green: 0.9,
                blue: 0.9
              }
            }
          }
        }
      }
    }
  ];
  
  // Make totals row bold
  for (let col = 0; col < headers.length; col++) {
    const cellKey = `${totalRowIndex},${col}`;
    const cellIndex = result.cellMap[cellKey];
    if (cellIndex) {
      totalRequests.push({
        updateTextStyle: {
          range: {
            startIndex: cellIndex,
            endIndex: cellIndex + totals[col].toString().length
          },
          textStyle: {
            bold: true
          },
          fields: 'bold'
        }
      });
    }
  }
  
  await docsClient.documents.batchUpdate({
    documentId,
    requestBody: { requests: totalRequests }
  });
  
  result.hint += ' Totals row added with bold formatting.';
  return result;
}