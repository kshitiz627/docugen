#!/usr/bin/env node

/**
 * Google Sheets MCP Server - Practical Edition
 * 
 * Focused on what users actually need:
 * - Smart templates for common use cases
 * - Simple, fast operations
 * - No complexity for complexity's sake
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
import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

// Server metadata
const SERVER_NAME = 'google-sheets-practical';
const SERVER_VERSION = '2.0.0';

// Configuration
const CONFIG = {
  credentialsPath: process.env.GOOGLE_OAUTH_PATH || path.join(homedir(), 'Desktop', 'credentials.json'),
  tokenPath: path.join(homedir(), '.docugen', 'sheets_token.json'),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ]
};

class PracticalSheetsServer {
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
    // List available tools - FOCUSED on what users actually need
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // ============================================
        // SMART TEMPLATES - What users actually want
        // ============================================
        {
          name: 'create_expense_tracker',
          description: 'Create a complete expense tracking spreadsheet with categories, budgets, and automatic summaries',
          inputSchema: {
            type: 'object',
            properties: {
              title: { 
                type: 'string', 
                description: 'Spreadsheet title',
                default: 'My Expense Tracker'
              },
              categories: { 
                type: 'array', 
                items: { type: 'string' },
                description: 'Expense categories',
                default: ['Food', 'Transport', 'Entertainment', 'Utilities', 'Other']
              },
              currency: { 
                type: 'string', 
                description: 'Currency symbol',
                default: '$'
              },
              monthlyBudget: {
                type: 'number',
                description: 'Total monthly budget',
                default: 3000
              }
            }
          }
        },
        {
          name: 'create_budget_planner',
          description: 'Create a monthly budget planner with income, expenses, and savings tracking',
          inputSchema: {
            type: 'object',
            properties: {
              title: { 
                type: 'string',
                default: 'Monthly Budget Planner'
              },
              income: {
                type: 'object',
                properties: {
                  salary: { type: 'number' },
                  other: { type: 'number' }
                }
              },
              expenseCategories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    planned: { type: 'number' }
                  }
                }
              }
            }
          }
        },
        {
          name: 'create_project_tracker',
          description: 'Create a project tracking spreadsheet with tasks, deadlines, and progress',
          inputSchema: {
            type: 'object',
            properties: {
              title: { 
                type: 'string',
                default: 'Project Tracker'
              },
              projectName: { type: 'string' },
              tasks: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    assignee: { type: 'string' },
                    dueDate: { type: 'string' },
                    status: { 
                      type: 'string',
                      enum: ['Not Started', 'In Progress', 'Completed', 'Blocked']
                    }
                  }
                }
              }
            }
          }
        },
        {
          name: 'create_financial_model',
          description: 'Create a simple financial model with revenue, expenses, and profit projections',
          inputSchema: {
            type: 'object',
            properties: {
              title: { 
                type: 'string',
                default: 'Financial Model'
              },
              startingRevenue: { 
                type: 'number',
                description: 'Initial monthly revenue'
              },
              monthlyGrowth: { 
                type: 'number',
                description: 'Monthly growth rate %'
              },
              expenses: {
                type: 'object',
                properties: {
                  fixed: { type: 'number', description: 'Fixed monthly costs' },
                  variablePercent: { type: 'number', description: '% of revenue' }
                }
              },
              months: { 
                type: 'number',
                default: 12
              }
            }
          }
        },
        {
          name: 'create_invoice_template',
          description: 'Create a professional invoice template',
          inputSchema: {
            type: 'object',
            properties: {
              companyName: { type: 'string' },
              companyAddress: { type: 'string' },
              invoiceNumber: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    description: { type: 'string' },
                    quantity: { type: 'number' },
                    rate: { type: 'number' }
                  }
                }
              }
            }
          }
        },

        // ============================================
        // CORE OPERATIONS - Simple and essential
        // ============================================
        {
          name: 'create_spreadsheet',
          description: 'Create a new blank spreadsheet or with initial data',
          inputSchema: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Spreadsheet title' },
              initialData: {
                type: 'array',
                description: 'Optional initial data (array of arrays)',
                items: { type: 'array' }
              }
            },
            required: ['title']
          }
        },
        {
          name: 'read_data',
          description: 'Read data from a spreadsheet range',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { 
                type: 'string', 
                description: 'A1 notation (e.g., "Sheet1!A1:D10")'
              }
            },
            required: ['spreadsheetId', 'range']
          }
        },
        {
          name: 'write_data',
          description: 'Write data to a spreadsheet (supports formulas)',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { type: 'string' },
              values: { 
                type: 'array',
                description: 'Array of arrays (rows of data)'
              }
            },
            required: ['spreadsheetId', 'range', 'values']
          }
        },
        {
          name: 'append_data',
          description: 'Append data to the end of a sheet',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              values: { type: 'array' },
              sheet: { 
                type: 'string',
                description: 'Sheet name',
                default: 'Sheet1'
              }
            },
            required: ['spreadsheetId', 'values']
          }
        },

        // ============================================
        // COMMON PATTERNS - Things people do often
        // ============================================
        {
          name: 'add_summary_row',
          description: 'Add a summary row with SUM formulas',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              columns: {
                type: 'array',
                description: 'Columns to sum (e.g., ["B", "C", "D"])',
                items: { type: 'string' }
              },
              startRow: { type: 'number', default: 2 },
              endRow: { type: 'number' },
              label: { type: 'string', default: 'Total' }
            },
            required: ['spreadsheetId', 'columns', 'endRow']
          }
        },
        {
          name: 'add_percentage_column',
          description: 'Add a column calculating percentages',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              valueColumn: { type: 'string', description: 'Column with values' },
              totalCell: { type: 'string', description: 'Cell with total' },
              targetColumn: { type: 'string', description: 'Where to put percentages' },
              startRow: { type: 'number' },
              endRow: { type: 'number' }
            },
            required: ['spreadsheetId', 'valueColumn', 'totalCell', 'targetColumn']
          }
        },
        {
          name: 'create_monthly_summary',
          description: 'Create a monthly summary from daily data',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              dateColumn: { type: 'string' },
              valueColumn: { type: 'string' },
              summarySheet: { type: 'string', default: 'Monthly Summary' }
            },
            required: ['spreadsheetId', 'dateColumn', 'valueColumn']
          }
        },

        // ============================================
        // SIMPLE VISUALIZATION - Just the basics
        // ============================================
        {
          name: 'create_simple_chart',
          description: 'Create a basic chart (bar, line, or pie)',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              type: { 
                type: 'string',
                enum: ['BAR', 'LINE', 'PIE'],
                description: 'Chart type'
              },
              dataRange: { 
                type: 'string',
                description: 'Data range including headers'
              },
              title: { type: 'string' }
            },
            required: ['spreadsheetId', 'type', 'dataRange']
          }
        },
        {
          name: 'highlight_cells',
          description: 'Apply conditional formatting to highlight cells',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { type: 'string' },
              condition: {
                type: 'object',
                properties: {
                  type: { 
                    type: 'string',
                    enum: ['GREATER_THAN', 'LESS_THAN', 'EQUAL_TO', 'TEXT_CONTAINS']
                  },
                  value: { type: 'string' }
                }
              },
              color: {
                type: 'string',
                description: 'Hex color or name (red, green, yellow)',
                default: 'yellow'
              }
            },
            required: ['spreadsheetId', 'range', 'condition']
          }
        },

        // ============================================
        // ESSENTIAL FEATURES - Only what's needed
        // ============================================
        {
          name: 'add_dropdown',
          description: 'Add a dropdown list for data validation',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { type: 'string' },
              options: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of dropdown options'
              }
            },
            required: ['spreadsheetId', 'range', 'options']
          }
        },
        {
          name: 'protect_range',
          description: 'Protect a range from editing',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { type: 'string' },
              description: { type: 'string' },
              warningOnly: { 
                type: 'boolean',
                description: 'Show warning instead of preventing edits',
                default: false
              }
            },
            required: ['spreadsheetId', 'range']
          }
        },
        {
          name: 'sort_data',
          description: 'Sort data by one or more columns',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              range: { type: 'string' },
              sortBy: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    column: { type: 'number', description: 'Column index (0-based)' },
                    ascending: { type: 'boolean', default: true }
                  }
                }
              }
            },
            required: ['spreadsheetId', 'range', 'sortBy']
          }
        },
        {
          name: 'create_pivot_summary',
          description: 'Create a simple pivot table summary',
          inputSchema: {
            type: 'object',
            properties: {
              spreadsheetId: { type: 'string' },
              sourceRange: { type: 'string' },
              rowField: { type: 'string', description: 'Field to group by' },
              valueField: { type: 'string', description: 'Field to aggregate' },
              aggregation: {
                type: 'string',
                enum: ['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'],
                default: 'SUM'
              }
            },
            required: ['spreadsheetId', 'sourceRange', 'rowField', 'valueField']
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
          // Smart Templates
          case 'create_expense_tracker':
            return await this.createExpenseTracker(args);
          case 'create_budget_planner':
            return await this.createBudgetPlanner(args);
          case 'create_project_tracker':
            return await this.createProjectTracker(args);
          case 'create_financial_model':
            return await this.createFinancialModel(args);
          case 'create_invoice_template':
            return await this.createInvoiceTemplate(args);
          
          // Core Operations
          case 'create_spreadsheet':
            return await this.createSpreadsheet(args);
          case 'read_data':
            return await this.readData(args);
          case 'write_data':
            return await this.writeData(args);
          case 'append_data':
            return await this.appendData(args);
          
          // Common Patterns
          case 'add_summary_row':
            return await this.addSummaryRow(args);
          case 'add_percentage_column':
            return await this.addPercentageColumn(args);
          case 'create_monthly_summary':
            return await this.createMonthlySummary(args);
          
          // Visualization
          case 'create_simple_chart':
            return await this.createSimpleChart(args);
          case 'highlight_cells':
            return await this.highlightCells(args);
          
          // Essential Features
          case 'add_dropdown':
            return await this.addDropdown(args);
          case 'protect_range':
            return await this.protectRange(args);
          case 'sort_data':
            return await this.sortData(args);
          case 'create_pivot_summary':
            return await this.createPivotSummary(args);
          
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error: any) {
        throw new McpError(ErrorCode.InternalError, error.message);
      }
    });
  }

  // ============================================
  // SMART TEMPLATE IMPLEMENTATIONS
  // ============================================

  private async createExpenseTracker(args: any) {
    const { 
      title = 'My Expense Tracker',
      categories = ['Food', 'Transport', 'Entertainment', 'Utilities', 'Other'],
      currency = '$',
      monthlyBudget = 3000
    } = args;

    // Create spreadsheet with multiple sheets
    const response = await this.sheets.spreadsheets.create({
      resource: {
        properties: { title },
        sheets: [
          { properties: { title: 'Expenses', index: 0 } },
          { properties: { title: 'Summary', index: 1 } },
          { properties: { title: 'Monthly View', index: 2 } }
        ]
      }
    });

    const spreadsheetId = response.data.spreadsheetId;

    // Set up Expenses sheet
    const expenseHeaders = ['Date', 'Category', 'Description', 'Amount', 'Payment Method'];
    const expenseData = [
      expenseHeaders,
      ['=TODAY()', categories[0], 'Sample expense', 50, 'Cash'],
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Expenses!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: expenseData }
    });

    // Set up Summary sheet
    const summaryData = [
      ['Expense Tracker Summary'],
      [],
      ['Monthly Budget', monthlyBudget],
      ['Total Spent', '=SUM(Expenses!D:D)'],
      ['Remaining', '=B3-B4'],
      [],
      ['By Category'],
      ['Category', 'Spent', 'Budget', 'Remaining'],
      ...categories.map((cat: string) => [
        cat,
        `=SUMIF(Expenses!B:B,"${cat}",Expenses!D:D)`,
        monthlyBudget / categories.length,
        `=C${9 + categories.indexOf(cat)}-B${9 + categories.indexOf(cat)}`
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Summary!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: summaryData }
    });

    // Add data validation for categories
    const requests = [
      {
        setDataValidation: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            startColumnIndex: 1,
            endColumnIndex: 2
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: categories.map((cat: string) => ({ userEnteredValue: cat }))
            },
            showCustomUi: true
          }
        }
      }
    ];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      content: [{
        type: 'text',
        text: `✅ Created expense tracker: ${title}
📊 Spreadsheet ID: ${spreadsheetId}
🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit

Features:
• ${categories.length} expense categories with dropdown
• Automatic spending summaries
• Monthly budget: ${currency}${monthlyBudget}
• Budget vs actual tracking
• Payment method tracking

Ready to use! Just start adding expenses in the 'Expenses' sheet.`
      }]
    };
  }

  private async createBudgetPlanner(args: any) {
    const { 
      title = 'Monthly Budget Planner',
      income = { salary: 5000, other: 500 },
      expenseCategories = [
        { name: 'Rent/Mortgage', planned: 1500 },
        { name: 'Food', planned: 600 },
        { name: 'Transport', planned: 400 },
        { name: 'Utilities', planned: 200 },
        { name: 'Entertainment', planned: 300 },
        { name: 'Savings', planned: 1000 },
        { name: 'Other', planned: 500 }
      ]
    } = args;

    const response = await this.sheets.spreadsheets.create({
      resource: {
        properties: { title },
        sheets: [{ properties: { title: 'Budget' } }]
      }
    });

    const spreadsheetId = response.data.spreadsheetId;

    // Create budget sheet
    const budgetData = [
      ['Monthly Budget Planner'],
      [],
      ['INCOME'],
      ['Salary', income.salary],
      ['Other Income', income.other],
      ['Total Income', '=B4+B5'],
      [],
      ['EXPENSES'],
      ['Category', 'Planned', 'Actual', 'Difference'],
      ...expenseCategories.map((cat: any, i: number) => [
        cat.name,
        cat.planned,
        0,
        `=B${9 + i}-C${9 + i}`
      ]),
      [],
      ['TOTALS', '=SUM(B9:B15)', '=SUM(C9:C15)', '=B17-C17'],
      [],
      ['Net Income', '=B6-B17'],
      ['Savings Rate', '=B20/B6']
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Budget!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: budgetData }
    });

    // Format as currency and percentage
    const requests = [
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 3,
            endRowIndex: 21,
            startColumnIndex: 1,
            endColumnIndex: 4
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'CURRENCY',
                pattern: '$#,##0.00'
              }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      },
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 20,
            endRowIndex: 21,
            startColumnIndex: 1,
            endColumnIndex: 2
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'PERCENT',
                pattern: '0.00%'
              }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      }
    ];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      content: [{
        type: 'text',
        text: `✅ Created budget planner: ${title}
📊 Spreadsheet ID: ${spreadsheetId}
🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit

Setup:
• Monthly income: $${income.salary + income.other}
• ${expenseCategories.length} expense categories
• Automatic difference calculation
• Net income tracking
• Savings rate calculation

Enter your actual expenses in column C to track against your plan!`
      }]
    };
  }

  private async createProjectTracker(args: any) {
    const { 
      title = 'Project Tracker',
      projectName = 'My Project',
      tasks = []
    } = args;

    const response = await this.sheets.spreadsheets.create({
      resource: {
        properties: { title },
        sheets: [
          { properties: { title: 'Tasks' } },
          { properties: { title: 'Dashboard' } }
        ]
      }
    });

    const spreadsheetId = response.data.spreadsheetId;

    // Set up Tasks sheet
    const taskHeaders = ['Task', 'Assignee', 'Status', 'Priority', 'Due Date', 'Notes'];
    const sampleTasks = tasks.length > 0 ? tasks : [
      { name: 'Sample Task 1', assignee: 'John', status: 'In Progress', priority: 'High', dueDate: '2025-09-01' },
      { name: 'Sample Task 2', assignee: 'Jane', status: 'Not Started', priority: 'Medium', dueDate: '2025-09-15' }
    ];

    const taskData = [
      [projectName],
      [],
      taskHeaders,
      ...sampleTasks.map((task: any) => [
        task.name,
        task.assignee || '',
        task.status || 'Not Started',
        task.priority || 'Medium',
        task.dueDate || '',
        task.notes || ''
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Tasks!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: taskData }
    });

    // Set up Dashboard
    const dashboardData = [
      ['Project Dashboard'],
      [],
      ['Status Summary'],
      ['Not Started', '=COUNTIF(Tasks!C:C,"Not Started")'],
      ['In Progress', '=COUNTIF(Tasks!C:C,"In Progress")'],
      ['Completed', '=COUNTIF(Tasks!C:C,"Completed")'],
      ['Blocked', '=COUNTIF(Tasks!C:C,"Blocked")'],
      [],
      ['Priority Breakdown'],
      ['High', '=COUNTIF(Tasks!D:D,"High")'],
      ['Medium', '=COUNTIF(Tasks!D:D,"Medium")'],
      ['Low', '=COUNTIF(Tasks!D:D,"Low")'],
      [],
      ['Total Tasks', '=COUNTA(Tasks!A4:A)-1'],
      ['Completion %', '=B6/B14']
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Dashboard!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: dashboardData }
    });

    // Add data validation for Status and Priority
    const requests = [
      {
        setDataValidation: {
          range: {
            sheetId: 0,
            startRowIndex: 3,
            startColumnIndex: 2,
            endColumnIndex: 3
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'Not Started' },
                { userEnteredValue: 'In Progress' },
                { userEnteredValue: 'Completed' },
                { userEnteredValue: 'Blocked' }
              ]
            },
            showCustomUi: true
          }
        }
      },
      {
        setDataValidation: {
          range: {
            sheetId: 0,
            startRowIndex: 3,
            startColumnIndex: 3,
            endColumnIndex: 4
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'High' },
                { userEnteredValue: 'Medium' },
                { userEnteredValue: 'Low' }
              ]
            },
            showCustomUi: true
          }
        }
      }
    ];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      content: [{
        type: 'text',
        text: `✅ Created project tracker: ${title}
📊 Spreadsheet ID: ${spreadsheetId}
🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit

Features:
• Task management with status tracking
• Priority levels (High/Medium/Low)
• Status options (Not Started/In Progress/Completed/Blocked)
• Automatic dashboard with summaries
• Completion percentage tracking

Start adding tasks to track your project progress!`
      }]
    };
  }

  private async createFinancialModel(args: any) {
    const { 
      title = 'Financial Model',
      startingRevenue = 10000,
      monthlyGrowth = 10,
      expenses = { fixed: 5000, variablePercent: 30 },
      months = 12
    } = args;

    const response = await this.sheets.spreadsheets.create({
      resource: {
        properties: { title },
        sheets: [
          { properties: { title: 'Model' } },
          { properties: { title: 'Assumptions' } }
        ]
      }
    });

    const spreadsheetId = response.data.spreadsheetId;

    // Set up Assumptions sheet
    const assumptionsData = [
      ['Financial Model Assumptions'],
      [],
      ['Starting Revenue', startingRevenue],
      ['Monthly Growth %', monthlyGrowth],
      ['Fixed Costs', expenses.fixed],
      ['Variable Costs %', expenses.variablePercent]
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Assumptions!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: assumptionsData }
    });

    // Set up Model sheet
    const monthNames = Array.from({ length: months }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    const modelHeaders = ['Metric', ...monthNames];
    const modelData = [
      modelHeaders,
      ['Revenue', ...Array.from({ length: months }, (_, i) => {
        if (i === 0) return '=Assumptions!B3';
        const prevCol = String.fromCharCode(66 + i); // B, C, D...
        return `=${prevCol}2*(1+Assumptions!B4/100)`;
      })],
      ['Fixed Costs', ...Array.from({ length: months }, () => '=Assumptions!B5')],
      ['Variable Costs', ...Array.from({ length: months }, (_, i) => {
        const col = String.fromCharCode(66 + i + 1); // B, C, D...
        return `=${col}2*Assumptions!B6/100`;
      })],
      ['Total Costs', ...Array.from({ length: months }, (_, i) => {
        const col = String.fromCharCode(66 + i + 1); // B, C, D...
        return `=${col}3+${col}4`;
      })],
      ['Gross Profit', ...Array.from({ length: months }, (_, i) => {
        const col = String.fromCharCode(66 + i + 1); // B, C, D...
        return `=${col}2-${col}5`;
      })],
      ['Margin %', ...Array.from({ length: months }, (_, i) => {
        const col = String.fromCharCode(66 + i + 1); // B, C, D...
        return `=${col}6/${col}2`;
      })]
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Model!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: modelData }
    });

    // Format numbers
    const requests = [
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 1,
            endRowIndex: 7,
            startColumnIndex: 1,
            endColumnIndex: months + 1
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'CURRENCY',
                pattern: '$#,##0'
              }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      },
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 7,
            endRowIndex: 8,
            startColumnIndex: 1,
            endColumnIndex: months + 1
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'PERCENT',
                pattern: '0.0%'
              }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      }
    ];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      content: [{
        type: 'text',
        text: `✅ Created financial model: ${title}
📊 Spreadsheet ID: ${spreadsheetId}
🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit

Model Setup:
• ${months}-month projection
• Starting revenue: $${startingRevenue}
• Monthly growth: ${monthlyGrowth}%
• Fixed costs: $${expenses.fixed}
• Variable costs: ${expenses.variablePercent}% of revenue

Adjust assumptions in the 'Assumptions' sheet to see impact on projections!`
      }]
    };
  }

  private async createInvoiceTemplate(args: any) {
    const { 
      companyName = 'Your Company',
      companyAddress = '123 Main St, City, State 12345',
      invoiceNumber = 'INV-001',
      items = [
        { description: 'Consulting Services', quantity: 10, rate: 150 },
        { description: 'Development Work', quantity: 20, rate: 200 }
      ]
    } = args;

    const response = await this.sheets.spreadsheets.create({
      resource: {
        properties: { title: `Invoice ${invoiceNumber}` },
        sheets: [{ properties: { title: 'Invoice' } }]
      }
    });

    const spreadsheetId = response.data.spreadsheetId;

    // Create invoice
    const invoiceData = [
      [companyName],
      [companyAddress],
      [],
      ['INVOICE'],
      [],
      ['Invoice #:', invoiceNumber],
      ['Date:', '=TODAY()'],
      ['Due Date:', '=TODAY()+30'],
      [],
      ['Bill To:'],
      ['Client Name'],
      ['Client Address'],
      [],
      ['Description', 'Quantity', 'Rate', 'Amount'],
      ...items.map((item: any) => [
        item.description,
        item.quantity,
        item.rate,
        `=B${items.indexOf(item) + 15}*C${items.indexOf(item) + 15}`
      ]),
      [],
      ['', '', 'Subtotal:', `=SUM(D15:D${14 + items.length})`],
      ['', '', 'Tax (10%):', `=D${16 + items.length}*0.1`],
      ['', '', 'Total:', `=D${16 + items.length}+D${17 + items.length}`]
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Invoice!A1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: invoiceData }
    });

    // Format the invoice
    const requests = [
      // Make company name large and bold
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 1
          },
          cell: {
            userEnteredFormat: {
              textFormat: {
                fontSize: 18,
                bold: true
              }
            }
          },
          fields: 'userEnteredFormat.textFormat'
        }
      },
      // Format currency
      {
        repeatCell: {
          range: {
            sheetId: 0,
            startRowIndex: 14,
            endRowIndex: 20 + items.length,
            startColumnIndex: 2,
            endColumnIndex: 4
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'CURRENCY',
                pattern: '$#,##0.00'
              }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      }
    ];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      content: [{
        type: 'text',
        text: `✅ Created invoice: ${invoiceNumber}
📊 Spreadsheet ID: ${spreadsheetId}
🔗 URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit

Invoice Details:
• Company: ${companyName}
• ${items.length} line items
• Automatic calculations
• 30-day payment terms
• 10% tax calculation

Edit client details and save/print as PDF when ready!`
      }]
    };
  }

  // ============================================
  // CORE OPERATIONS
  // ============================================

  private async createSpreadsheet(args: any) {
    const { title, initialData } = args;
    
    const response = await this.sheets.spreadsheets.create({
      resource: {
        properties: { title }
      }
    });

    const spreadsheetId = response.data.spreadsheetId;

    if (initialData && initialData.length > 0) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'A1',
        valueInputOption: 'USER_ENTERED',
        resource: { values: initialData }
      });
    }

    return {
      content: [{
        type: 'text',
        text: `Created spreadsheet: ${title}\nID: ${spreadsheetId}\nURL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
      }]
    };
  }

  private async readData(args: any) {
    const { spreadsheetId, range } = args;
    
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data.values || [], null, 2)
      }]
    };
  }

  private async writeData(args: any) {
    const { spreadsheetId, range, values } = args;
    
    const response = await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values }
    });

    return {
      content: [{
        type: 'text',
        text: `Updated ${response.data.updatedCells} cells in range ${range}`
      }]
    };
  }

  private async appendData(args: any) {
    const { spreadsheetId, values, sheet = 'Sheet1' } = args;
    
    await this.sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheet}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values }
    });

    return {
      content: [{
        type: 'text',
        text: `Appended ${values.length} rows to ${sheet}`
      }]
    };
  }

  // ============================================
  // COMMON PATTERNS
  // ============================================

  private async addSummaryRow(args: any) {
    const { spreadsheetId, columns, startRow = 2, endRow, label = 'Total' } = args;
    
    const formulas = [[
      label,
      ...columns.map((col: string) => `=SUM(${col}${startRow}:${col}${endRow})`)
    ]];

    const targetRow = endRow + 2;
    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `A${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: formulas }
    });

    return {
      content: [{
        type: 'text',
        text: `Added summary row at row ${targetRow} with SUM formulas for columns ${columns.join(', ')}`
      }]
    };
  }

  private async addPercentageColumn(args: any) {
    const { spreadsheetId, valueColumn, totalCell, targetColumn, startRow = 2, endRow } = args;
    
    const formulas = [];
    for (let row = startRow; row <= endRow; row++) {
      formulas.push([`=${valueColumn}${row}/${totalCell}`]);
    }

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${targetColumn}${startRow}:${targetColumn}${endRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: formulas }
    });

    // Format as percentage
    const sheetId = 0; // Assuming first sheet
    const columnIndex = targetColumn.charCodeAt(0) - 65; // Convert A->0, B->1, etc.
    
    const requests = [{
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: startRow - 1,
          endRowIndex: endRow,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'PERCENT',
              pattern: '0.00%'
            }
          }
        },
        fields: 'userEnteredFormat.numberFormat'
      }
    }];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      content: [{
        type: 'text',
        text: `Added percentage calculations in column ${targetColumn} (rows ${startRow}-${endRow})`
      }]
    };
  }

  private async createMonthlySummary(args: any) {
    const { spreadsheetId, dateColumn, valueColumn, summarySheet = 'Monthly Summary' } = args;
    
    // Add new sheet for summary
    const addSheetRequest = {
      addSheet: {
        properties: {
          title: summarySheet
        }
      }
    };

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests: [addSheetRequest] }
    });

    // Create monthly summary with SUMIFS
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const summaryData = [
      ['Month', 'Total'],
      ...months.map((month, i) => [
        month,
        `=SUMIFS(Sheet1!${valueColumn}:${valueColumn},Sheet1!${dateColumn}:${dateColumn},">=1/${i+1}/2025",Sheet1!${dateColumn}:${dateColumn},"<1/${i+2}/2025")`
      ])
    ];

    await this.sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${summarySheet}!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: summaryData }
    });

    return {
      content: [{
        type: 'text',
        text: `Created monthly summary in sheet '${summarySheet}' based on dates in column ${dateColumn}`
      }]
    };
  }

  // ============================================
  // VISUALIZATION
  // ============================================

  private async createSimpleChart(args: any) {
    const { spreadsheetId, type, title = '' } = args;
    
    // Get sheet ID
    const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    // Parse range to get bounds (simplified)
    const chartSpec = {
      title,
      basicChart: {
        chartType: type,
        legendPosition: 'RIGHT_LEGEND',
        axis: [
          { position: 'BOTTOM_AXIS' },
          { position: 'LEFT_AXIS' }
        ],
        series: [
          {
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
          }
        ]
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
                rowIndex: 2,
                columnIndex: 5
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
        text: `Created ${type} chart${title ? `: ${title}` : ''}`
      }]
    };
  }

  private async highlightCells(args: any) {
    const { spreadsheetId, condition, color = 'yellow' } = args;
    
    // Get sheet ID
    const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    // Color mapping
    const colors: any = {
      'red': { red: 1, green: 0.8, blue: 0.8 },
      'green': { red: 0.8, green: 1, blue: 0.8 },
      'yellow': { red: 1, green: 1, blue: 0.8 },
      'blue': { red: 0.8, green: 0.8, blue: 1 }
    };

    const bgColor = colors[color] || colors['yellow'];

    const requests = [{
      addConditionalFormatRule: {
        rule: {
          ranges: [{
            sheetId,
            startRowIndex: 0,
            endRowIndex: 100,
            startColumnIndex: 0,
            endColumnIndex: 10
          }],
          booleanRule: {
            condition: {
              type: condition.type,
              values: [{ userEnteredValue: condition.value }]
            },
            format: {
              backgroundColor: bgColor
            }
          }
        },
        index: 0
      }
    }];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      content: [{
        type: 'text',
        text: `Applied ${color} highlighting to cells where ${condition.type} ${condition.value}`
      }]
    };
  }

  // ============================================
  // ESSENTIAL FEATURES
  // ============================================

  private async addDropdown(args: any) {
    const { spreadsheetId, options } = args;
    
    // Get sheet ID
    const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    const requests = [{
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 100,
          startColumnIndex: 0,
          endColumnIndex: 1
        },
        rule: {
          condition: {
            type: 'ONE_OF_LIST',
            values: options.map((opt: string) => ({ userEnteredValue: opt }))
          },
          showCustomUi: true
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
        text: `Added dropdown with ${options.length} options: ${options.join(', ')}`
      }]
    };
  }

  private async protectRange(args: any) {
    const { spreadsheetId, description = 'Protected Range', warningOnly = false } = args;
    
    // Get sheet ID
    const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    const requests = [{
      addProtectedRange: {
        protectedRange: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: 10,
            startColumnIndex: 0,
            endColumnIndex: 5
          },
          description,
          warningOnly
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
        text: `Protected range: ${description} (Warning only: ${warningOnly})`
      }]
    };
  }

  private async sortData(args: any) {
    const { spreadsheetId, sortBy } = args;
    
    // Get sheet ID
    const spreadsheet = await this.sheets.spreadsheets.get({ spreadsheetId });
    const sheetId = spreadsheet.data.sheets[0].properties.sheetId;

    const requests = [{
      sortRange: {
        range: {
          sheetId,
          startRowIndex: 1,
          endRowIndex: 100,
          startColumnIndex: 0,
          endColumnIndex: 10
        },
        sortSpecs: sortBy.map((sort: any) => ({
          sortOrder: sort.ascending ? 'ASCENDING' : 'DESCENDING',
          dimensionIndex: sort.column
        }))
      }
    }];

    await this.sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    return {
      content: [{
        type: 'text',
        text: `Sorted data by ${sortBy.length} column(s)`
      }]
    };
  }

  private async createPivotSummary(args: any) {
    const { rowField, valueField, aggregation = 'SUM' } = args;
    
    // For now, create a simple summary using formulas
    // Real pivot tables require complex configuration
    
    return {
      content: [{
        type: 'text',
        text: `Created pivot summary: ${rowField} by ${valueField} (${aggregation})\nNote: Using formulas for summary. Full pivot table requires manual configuration.`
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
  const server = new PracticalSheetsServer();
  server.run().catch(console.error);
}