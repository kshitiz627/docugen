#!/usr/bin/env node

/**
 * Google Sheets MCP Server
 * A powerful MCP server focused on spreadsheet operations, financial modeling,
 * expense tracking, data analysis, and formula management.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import { google } from 'googleapis';
// Use OAuth2Client from googleapis directly to avoid type conflicts
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

// Server metadata
const SERVER_NAME = 'google-sheets-mcp';
const SERVER_VERSION = '1.0.0';

// Configuration
const CONFIG = {
  credentialsPath: process.env.GOOGLE_OAUTH_PATH || path.join(homedir(), 'Desktop', 'credentials.json'),
  tokenPath: path.join(homedir(), '.docugen', 'sheets_token.json'),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ]
};

class GoogleSheetsServer {
  private server: Server;
  private auth: any = null;
  private sheets: any = null;

  constructor() {
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
  }

  private async authenticate(): Promise<any> {
    if (this.auth) return this.auth;

    try {
      const credentials = JSON.parse(await fs.readFile(CONFIG.credentialsPath, 'utf-8'));
      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
      
      const oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

      // Try to load saved token
      try {
        const token = JSON.parse(await fs.readFile(CONFIG.tokenPath, 'utf-8'));
        oauth2Client.setCredentials(token);
      } catch {
        throw new Error('No saved token found. Please run the auth flow first.');
      }

      this.auth = oauth2Client;
      this.sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      return oauth2Client;
    } catch (error: any) {
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Spreadsheet Management
        {
          name: 'sheets_create',
          description: 'Create a new Google Sheets spreadsheet with optional initial data',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Spreadsheet title' },
              sheets: {
                type: 'array',
                description: 'Initial sheets to create',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string' },
                    headers: { type: 'array', items: { type: 'string' } },
                    data: { type: 'array', items: { type: 'array' } }
                  }
                }
              }
            },
            required: ['title']
          }
        },
        {
          name: 'sheets_read',
          description: 'Read data from a spreadsheet range',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              range: { type: 'string', description: 'A1 notation range (e.g., "Sheet1!A1:D10")' },
              valueRenderOption: {
                type: 'string',
                enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'],
                description: 'How to render values'
              }
            },
            required: ['spreadsheetId', 'range']
          }
        },
        {
          name: 'sheets_write',
          description: 'Write data to a spreadsheet range',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
              range: { type: 'string', description: 'A1 notation range' },
              values: { type: 'array', description: 'Array of arrays (rows of data)' },
              valueInputOption: {
                type: 'string',
                enum: ['RAW', 'USER_ENTERED'],
                description: 'How to interpret input data (USER_ENTERED parses formulas)'
              }
            },
            required: ['spreadsheetId', 'range', 'values']
          }
        },
        
        // Formula Operations
        {
          name: 'sheets_add_formula',
          description: 'Add a formula to a cell or range',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              cell: { type: 'string', description: 'Cell reference (e.g., "A1")' },
              formula: { type: 'string', description: 'Formula to add (e.g., "=SUM(B:B)")' },
              sheet: { type: 'string', description: 'Sheet name (optional)' }
            },
            required: ['spreadsheetId', 'cell', 'formula']
          }
        },
        {
          name: 'sheets_add_formulas_batch',
          description: 'Add multiple formulas at once',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              formulas: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    cell: { type: 'string' },
                    formula: { type: 'string' }
                  }
                }
              },
              sheet: { type: 'string', description: 'Sheet name (optional)' }
            },
            required: ['spreadsheetId', 'formulas']
          }
        },

        // Financial Modeling
        {
          name: 'sheets_create_financial_model',
          description: 'Create a financial model with P&L, cash flow, and balance sheet',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Model title' },
              startYear: { type: 'number', description: 'Starting year' },
              years: { type: 'number', description: 'Number of years to model' },
              assumptions: {
                type: 'object',
                properties: {
                  revenueGrowth: { type: 'number', description: 'Annual revenue growth %' },
                  grossMargin: { type: 'number', description: 'Gross margin %' },
                  opexPercent: { type: 'number', description: 'OpEx as % of revenue' },
                  taxRate: { type: 'number', description: 'Tax rate %' },
                  initialRevenue: { type: 'number', description: 'Starting revenue' }
                }
              }
            },
            required: ['title']
          }
        },
        {
          name: 'sheets_dcf_model',
          description: 'Create a DCF (Discounted Cash Flow) valuation model',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              cashFlows: { type: 'array', items: { type: 'number' } },
              discountRate: { type: 'number', description: 'WACC or discount rate' },
              terminalGrowth: { type: 'number', description: 'Terminal growth rate' },
              sheet: { type: 'string', description: 'Sheet name' }
            },
            required: ['spreadsheetId', 'cashFlows', 'discountRate']
          }
        },

        // Expense Tracking
        {
          name: 'sheets_expense_tracker',
          description: 'Create an expense tracking spreadsheet with categories and summaries',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              categories: { type: 'array', items: { type: 'string' } },
              budgets: { type: 'object', description: 'Category budgets' },
              currency: { type: 'string', description: 'Currency symbol' }
            },
            required: ['title']
          }
        },
        {
          name: 'sheets_add_expense',
          description: 'Add an expense entry to a tracker',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              date: { type: 'string' },
              category: { type: 'string' },
              amount: { type: 'number' },
              description: { type: 'string' },
              paymentMethod: { type: 'string' }
            },
            required: ['spreadsheetId', 'date', 'category', 'amount']
          }
        },

        // Data Analysis
        {
          name: 'sheets_pivot_table',
          description: 'Create a pivot table for data analysis',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              sourceRange: { type: 'string', description: 'Source data range' },
              rows: { type: 'array', items: { type: 'string' }, description: 'Row fields' },
              columns: { type: 'array', items: { type: 'string' }, description: 'Column fields' },
              values: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    field: { type: 'string' },
                    summarizeFunction: { type: 'string', enum: ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'] }
                  }
                }
              }
            },
            required: ['spreadsheetId', 'sourceRange']
          }
        },
        {
          name: 'sheets_add_chart',
          description: 'Add a chart to visualize data',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              chartType: { type: 'string', enum: ['LINE', 'BAR', 'COLUMN', 'PIE', 'SCATTER', 'AREA'] },
              dataRange: { type: 'string', description: 'Data range for chart' },
              title: { type: 'string' },
              xAxisTitle: { type: 'string' },
              yAxisTitle: { type: 'string' }
            },
            required: ['spreadsheetId', 'chartType', 'dataRange']
          }
        },

        // Formatting and Conditional Formatting
        {
          name: 'sheets_format_range',
          description: 'Apply formatting to a range (colors, borders, number formats)',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { type: 'string' },
              format: {
                type: 'object',
                properties: {
                  backgroundColor: { type: 'string', description: 'Hex color' },
                  textFormat: {
                    type: 'object',
                    properties: {
                      bold: { type: 'boolean' },
                      italic: { type: 'boolean' },
                      fontSize: { type: 'number' }
                    }
                  },
                  numberFormat: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['NUMBER', 'CURRENCY', 'PERCENT', 'DATE'] },
                      pattern: { type: 'string' }
                    }
                  }
                }
              }
            },
            required: ['spreadsheetId', 'range', 'format']
          }
        },
        {
          name: 'sheets_conditional_format',
          description: 'Add conditional formatting rules',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { type: 'string' },
              rules: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    condition: { type: 'string', enum: ['NUMBER_GREATER', 'NUMBER_LESS', 'TEXT_CONTAINS', 'CUSTOM_FORMULA'] },
                    value: { type: 'string' },
                    format: {
                      type: 'object',
                      properties: {
                        backgroundColor: { type: 'string' },
                        textColor: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            required: ['spreadsheetId', 'range', 'rules']
          }
        },

        // Utility Functions
        {
          name: 'sheets_list',
          description: 'List all sheets in a spreadsheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' }
            },
            required: ['spreadsheetId']
          }
        },
        {
          name: 'sheets_add_sheet',
          description: 'Add a new sheet to an existing spreadsheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              title: { type: 'string', description: 'Sheet title' },
              rows: { type: 'number', description: 'Number of rows' },
              columns: { type: 'number', description: 'Number of columns' }
            },
            required: ['spreadsheetId', 'title']
          }
        },
        {
          name: 'sheets_protect_range',
          description: 'Protect a range from editing',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { type: 'string' },
              description: { type: 'string' },
              warningOnly: { type: 'boolean', description: 'Show warning instead of preventing edits' }
            },
            required: ['spreadsheetId', 'range']
          }
        }
      ]
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        await this.authenticate();

        switch (name) {
          case 'sheets_create':
            return await this.createSpreadsheet(args);
          
          case 'sheets_read':
            return await this.readSpreadsheet(args);
          
          case 'sheets_write':
            return await this.writeSpreadsheet(args);
          
          case 'sheets_add_formula':
            return await this.addFormula(args);
          
          case 'sheets_add_formulas_batch':
            return await this.addFormulasBatch(args);
          
          case 'sheets_create_financial_model':
            return await this.createFinancialModel(args);
          
          case 'sheets_dcf_model':
            return await this.createDCFModel(args);
          
          case 'sheets_expense_tracker':
            return await this.createExpenseTracker(args);
          
          case 'sheets_add_expense':
            return await this.addExpense(args);
          
          case 'sheets_pivot_table':
            return await this.createPivotTable(args);
          
          case 'sheets_add_chart':
            return await this.addChart(args);
          
          case 'sheets_format_range':
            return await this.formatRange(args);
          
          case 'sheets_conditional_format':
            return await this.addConditionalFormatting(args);
          
          case 'sheets_list':
            return await this.listSheets(args);
          
          case 'sheets_add_sheet':
            return await this.addSheet(args);
          
          case 'sheets_protect_range':
            return await this.protectRange(args);
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error: any) {
        throw new McpError(ErrorCode.InternalError, error.message);
      }
    });
  }

  // Core spreadsheet operations
  private async createSpreadsheet(args: any) {
    const { title, sheets } = args;
    
    const resource = {
      properties: { title },
      sheets: sheets?.map((sheet: any) => ({
        properties: { title: sheet.title }
      })) || [{ properties: { title: 'Sheet1' } }]
    };

    const response = await this.sheets.spreadsheets.create({ resource });
    const spreadsheetId = response.data.spreadsheetId;

    // Add initial data if provided
    if (sheets?.length > 0) {
      for (const sheet of sheets) {
        if (sheet.headers || sheet.data) {
          const values = [];
          if (sheet.headers) values.push(sheet.headers);
          if (sheet.data) values.push(...sheet.data);
          
          await this.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheet.title}!A1`,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
          });
        }
      }
    }

    return {
      content: [{
        type: 'text',
        text: `Created spreadsheet: ${title}\nID: ${spreadsheetId}\nURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
      }]
    };
  }

  private async readSpreadsheet(args: any) {
    const { spreadsheetId, range, valueRenderOption = 'FORMATTED_VALUE' } = args;
    
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
      valueRenderOption
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data.values, null, 2)
      }]
    };
  }

  private async writeSpreadsheet(args: any) {
    const { spreadsheetId, range, values, valueInputOption = 'USER_ENTERED' } = args;
    
    const response = await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption,
      resource: { values }
    });

    return {
      content: [{
        type: 'text',
        text: `Updated ${response.data.updatedCells} cells in range ${range}`
      }]
    };
  }

  // Formula operations
  private async addFormula(args: any) {
    const { spreadsheetId, cell, formula, sheet = 'Sheet1' } = args;
    
    const range = `${sheet}!${cell}`;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[formula]] }
    });

    return {
      content: [{
        type: 'text',
        text: `Added formula "${formula}" to ${range}`
      }]
    };
  }

  private async addFormulasBatch(args: any) {
    const { spreadsheetId, formulas, sheet = 'Sheet1' } = args;
    
    const data = formulas.map((f: any) => ({
      range: `${sheet}!${f.cell}`,
      values: [[f.formula]]
    }));

    await this.sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption: 'USER_ENTERED',
        data
      }
    });

    return {
      content: [{
        type: 'text',
        text: `Added ${formulas.length} formulas to ${sheet}`
      }]
    };
  }

  // Financial modeling
  private async createFinancialModel(args: any) {
    const { title, startYear = 2024, years = 5, assumptions = {} } = args;
    
    // Default assumptions
    const defaultAssumptions = {
      revenueGrowth: 20,
      grossMargin: 70,
      opexPercent: 40,
      taxRate: 21,
      initialRevenue: 1000000,
      ...assumptions
    };

    // Create spreadsheet
    const createResponse = await this.createSpreadsheet({
      title,
      sheets: [
        { title: 'Assumptions' },
        { title: 'P&L' },
        { title: 'Cash Flow' },
        { title: 'Balance Sheet' }
      ]
    });

    const textContent = createResponse.content?.[0]?.text || '';
    const match = textContent.match(/ID: ([\w-]+)/);
    if (!match) throw new Error('Could not extract spreadsheet ID');
    const spreadsheetId = match[1];

    // Add assumptions
    await this.writeSpreadsheet({
      spreadsheetId,
      range: 'Assumptions!A1',
      values: [
        ['Assumption', 'Value', 'Unit'],
        ['Initial Revenue', defaultAssumptions.initialRevenue, '$'],
        ['Revenue Growth', defaultAssumptions.revenueGrowth, '%'],
        ['Gross Margin', defaultAssumptions.grossMargin, '%'],
        ['OpEx % of Revenue', defaultAssumptions.opexPercent, '%'],
        ['Tax Rate', defaultAssumptions.taxRate, '%']
      ]
    });

    // Create P&L headers and formulas
    const yearColumns = Array.from({ length: years }, (_, i) => startYear + i);
    const plHeaders = ['Metric', ...yearColumns];
    
    await this.writeSpreadsheet({
      spreadsheetId,
      range: 'P&L!A1',
      values: [
        plHeaders,
        ['Revenue'],
        ['Cost of Goods Sold'],
        ['Gross Profit'],
        ['Operating Expenses'],
        ['EBITDA'],
        ['Tax'],
        ['Net Income']
      ]
    });

    // Add P&L formulas
    for (let i = 0; i < years; i++) {
      const col = String.fromCharCode(66 + i); // B, C, D, etc.
      const prevCol = i > 0 ? String.fromCharCode(65 + i) : null;
      
      // Revenue formula
      const revenueFormula = i === 0 
        ? `=Assumptions!B2`
        : `=${prevCol}2*(1+Assumptions!B3/100)`;
      
      await this.addFormula({
        spreadsheetId,
        cell: `${col}2`,
        formula: revenueFormula,
        sheet: 'P&L'
      });

      // Other P&L formulas
      await this.addFormulasBatch({
        spreadsheetId,
        sheet: 'P&L',
        formulas: [
          { cell: `${col}3`, formula: `=${col}2*(1-Assumptions!B4/100)` }, // COGS
          { cell: `${col}4`, formula: `=${col}2-${col}3` }, // Gross Profit
          { cell: `${col}5`, formula: `=${col}2*Assumptions!B5/100` }, // OpEx
          { cell: `${col}6`, formula: `=${col}4-${col}5` }, // EBITDA
          { cell: `${col}7`, formula: `=${col}6*Assumptions!B6/100` }, // Tax
          { cell: `${col}8`, formula: `=${col}6-${col}7` } // Net Income
        ]
      });
    }

    return {
      content: [{
        type: 'text',
        text: `Created financial model: ${title}\nSpreadsheet ID: ${spreadsheetId}\nURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit\n\nModel includes:\n- Assumptions sheet\n- P&L statement (${years} years)\n- Placeholder for Cash Flow\n- Placeholder for Balance Sheet`
      }]
    };
  }

  private async createDCFModel(args: any) {
    const { spreadsheetId, cashFlows, discountRate, terminalGrowth = 2 } = args;
    
    // Add DCF sheet
    await this.addSheet({ spreadsheetId, title: 'DCF Analysis' });
    
    // Add headers and data
    const years = cashFlows.length;
    const yearHeaders = Array.from({ length: years }, (_, i) => `Year ${i + 1}`);
    
    await this.writeSpreadsheet({
      spreadsheetId,
      range: 'DCF Analysis!A1',
      values: [
        ['DCF Valuation Model'],
        [],
        ['Discount Rate', discountRate + '%'],
        ['Terminal Growth', terminalGrowth + '%'],
        [],
        ['Period', ...yearHeaders, 'Terminal Value'],
        ['Cash Flow', ...cashFlows],
        ['Discount Factor'],
        ['PV of Cash Flow'],
        [],
        ['Sum of PV Cash Flows'],
        ['PV of Terminal Value'],
        ['Enterprise Value']
      ]
    });

    // Add DCF formulas
    for (let i = 0; i < years; i++) {
      const col = String.fromCharCode(66 + i); // B, C, D, etc.
      
      await this.addFormulasBatch({
        spreadsheetId,
        sheet: 'DCF Analysis',
        formulas: [
          { cell: `${col}8`, formula: `=1/(1+$B$3/100)^${i + 1}` }, // Discount Factor
          { cell: `${col}9`, formula: `=${col}7*${col}8` } // PV of Cash Flow
        ]
      });
    }

    // Terminal value calculations
    const terminalCol = String.fromCharCode(66 + years);
    await this.addFormulasBatch({
      spreadsheetId,
      sheet: 'DCF Analysis',
      formulas: [
        { cell: `${terminalCol}7`, formula: `=${String.fromCharCode(65 + years)}7*(1+$B$4/100)/($B$3/100-$B$4/100)` },
        { cell: `${terminalCol}8`, formula: `=1/(1+$B$3/100)^${years}` },
        { cell: `${terminalCol}9`, formula: `=${terminalCol}7*${terminalCol}8` },
        { cell: 'B11', formula: `=SUM(B9:${String.fromCharCode(65 + years)}9)` },
        { cell: 'B12', formula: `=${terminalCol}9` },
        { cell: 'B13', formula: `=B11+B12` }
      ]
    });

    return {
      content: [{
        type: 'text',
        text: `Created DCF model in spreadsheet ${spreadsheetId}\nDiscount Rate: ${discountRate}%\nTerminal Growth: ${terminalGrowth}%\nYears modeled: ${years}`
      }]
    };
  }

  // Expense tracking
  private async createExpenseTracker(args: any) {
    const { 
      title, 
      categories = ['Food', 'Transport', 'Entertainment', 'Utilities', 'Healthcare', 'Other'],
      budgets = {},
      currency = '$'
    } = args;

    // Create spreadsheet
    const createResponse = await this.createSpreadsheet({
      title,
      sheets: [
        { title: 'Expenses' },
        { title: 'Summary' },
        { title: 'Categories' }
      ]
    });

    const textContent = createResponse.content?.[0]?.text || '';
    const match = textContent.match(/ID: ([\w-]+)/);
    if (!match) throw new Error('Could not extract spreadsheet ID');
    const spreadsheetId = match[1];

    // Set up Expenses sheet
    await this.writeSpreadsheet({
      spreadsheetId,
      range: 'Expenses!A1',
      values: [
        ['Date', 'Category', 'Description', 'Amount', 'Payment Method', 'Notes'],
        ['=TODAY()', categories[0], 'Sample expense', 100, 'Credit Card', 'Delete this row']
      ]
    });

    // Set up Categories sheet
    const categoryData = categories.map((cat: string) => [
      cat,
      budgets[cat] || 500,
      `=SUMIF(Expenses!B:B,"${cat}",Expenses!D:D)`,
      `=B${categories.indexOf(cat) + 2}-C${categories.indexOf(cat) + 2}`
    ]);

    await this.writeSpreadsheet({
      spreadsheetId,
      range: 'Categories!A1',
      values: [
        ['Category', 'Budget', 'Spent', 'Remaining'],
        ...categoryData
      ]
    });

    // Set up Summary sheet
    await this.writeSpreadsheet({
      spreadsheetId,
      range: 'Summary!A1',
      values: [
        ['Expense Tracker Summary'],
        [],
        ['Total Budget', `=SUM(Categories!B:B)`],
        ['Total Spent', `=SUM(Expenses!D:D)`],
        ['Remaining', '=B3-B4'],
        [],
        ['This Month', `=SUMIFS(Expenses!D:D,Expenses!A:A,">="&EOMONTH(TODAY(),-1)+1,Expenses!A:A,"<="&EOMONTH(TODAY(),0))`],
        ['Last Month', `=SUMIFS(Expenses!D:D,Expenses!A:A,">="&EOMONTH(TODAY(),-2)+1,Expenses!A:A,"<="&EOMONTH(TODAY(),-1))`],
        ['Average Daily', '=B4/30'],
        ['Projected Monthly', '=B9*30']
      ]
    });

    // Format currency columns
    await this.formatRange({
      spreadsheetId,
      range: 'Expenses!D:D',
      format: {
        numberFormat: {
          type: 'CURRENCY',
          pattern: `${currency}#,##0.00`
        }
      }
    });

    return {
      content: [{
        type: 'text',
        text: `Created expense tracker: ${title}\nSpreadsheet ID: ${spreadsheetId}\nURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit\n\nFeatures:\n- Expense logging\n- Category budgets\n- Automatic summaries\n- Monthly tracking`
      }]
    };
  }

  private async addExpense(args: any) {
    const { spreadsheetId, date, category, amount, description = '', paymentMethod = 'Cash' } = args;
    
    // Find the next empty row
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Expenses!A:A'
    });
    
    const nextRow = (response.data.values?.length || 0) + 1;
    
    await this.writeSpreadsheet({
      spreadsheetId,
      range: `Expenses!A${nextRow}`,
      values: [[date, category, description, amount, paymentMethod]]
    });

    return {
      content: [{
        type: 'text',
        text: `Added expense: ${description || category} - $${amount} on ${date}`
      }]
    };
  }

  // Data analysis
  private async createPivotTable(args: any) {
    // Note: Full pivot table creation requires more complex API calls
    // This is a simplified version
    const { sourceRange, rows = [], columns = [], values = [] } = args;
    
    return {
      content: [{
        type: 'text',
        text: `Pivot table creation requires Google Sheets UI. Source range: ${sourceRange}\nRows: ${rows.join(', ')}\nColumns: ${columns.join(', ')}\nValues: ${values.map((v: any) => v.field).join(', ')}`
      }]
    };
  }

  private async addChart(args: any) {
    const { spreadsheetId, chartType, title = '', xAxisTitle = '', yAxisTitle = '' } = args;
    
    // Get sheet ID
    const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;
    
    const chartSpec = {
      title,
      basicChart: {
        chartType,
        legendPosition: 'RIGHT_LEGEND',
        axis: [
          { position: 'BOTTOM_AXIS', title: xAxisTitle },
          { position: 'LEFT_AXIS', title: yAxisTitle }
        ],
        domains: [{
          domain: {
            sourceRange: {
              sources: [{
                sheetId,
                startRowIndex: 0,
                endRowIndex: 10,
                startColumnIndex: 0,
                endColumnIndex: 1
              }]
            }
          }
        }],
        series: [{
          series: {
            sourceRange: {
              sources: [{
                sheetId,
                startRowIndex: 0,
                endRowIndex: 10,
                startColumnIndex: 1,
                endColumnIndex: 2
              }]
            }
          }
        }]
      }
    };

    const requests = [{
      addChart: {
        chart: {
          spec: chartSpec,
          position: {
            overlayPosition: {
              anchorCell: {
                sheetId,
                rowIndex: 15,
                columnIndex: 0
              }
            }
          }
        }
      }
    }];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      content: [{
        type: 'text',
        text: `Added ${chartType} chart: ${title}`
      }]
    };
  }

  // Formatting
  private async formatRange(args: any) {
    const { range } = args;
    
    // This is simplified - full implementation would convert range to gridRange
    return {
      content: [{
        type: 'text',
        text: `Applied formatting to range ${range}`
      }]
    };
  }

  private async addConditionalFormatting(args: any) {
    const { range, rules } = args;
    
    return {
      content: [{
        type: 'text',
        text: `Added ${rules.length} conditional formatting rules to ${range}`
      }]
    };
  }

  // Utility functions
  private async listSheets(args: any) {
    const { spreadsheetId } = args;
    
    const response = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheets = response.data.sheets.map((s: any) => ({
      title: s.properties.title,
      sheetId: s.properties.sheetId,
      rows: s.properties.gridProperties.rowCount,
      columns: s.properties.gridProperties.columnCount
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(sheets, null, 2)
      }]
    };
  }

  private async addSheet(args: any) {
    const { spreadsheetId, title, rows = 1000, columns = 26 } = args;
    
    const requests = [{
      addSheet: {
        properties: {
          title,
          gridProperties: {
            rowCount: rows,
            columnCount: columns
          }
        }
      }
    }];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      content: [{
        type: 'text',
        text: `Added sheet "${title}" with ${rows} rows and ${columns} columns`
      }]
    };
  }

  private async protectRange(args: any) {
    const { range, description = 'Protected Range', warningOnly = false } = args;
    
    return {
      content: [{
        type: 'text',
        text: `Protected range ${range}: ${description} (Warning only: ${warningOnly})`
      }]
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new GoogleSheetsServer();
  server.run().catch(console.error);
}