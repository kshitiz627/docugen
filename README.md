# Google Sheets MCP Server

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org)
[![npm version](https://img.shields.io/npm/v/@digitalgreen/sheets-mcp.svg)](https://www.npmjs.com/package/@digitalgreen/sheets-mcp)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple)](https://modelcontextprotocol.io)
[![Google APIs](https://img.shields.io/badge/Google%20APIs-Sheets%20%26%20Drive-34A853)](https://developers.google.com/sheets/api)

**Powerful Google Sheets automation for AI assistants. Financial modeling, expense tracking, data analysis, formulas, and more.**

## Features

### 📊 Core Spreadsheet Operations
- Create and manage Google Sheets spreadsheets
- Read and write data with formula support
- Batch operations for efficiency
- Multiple sheet management

### 💰 Financial Modeling
- **P&L Statements** - Automated profit & loss generation
- **Cash Flow Models** - Multi-year projections
- **DCF Valuation** - Discounted cash flow analysis
- **Financial Ratios** - Automatic calculation
- **Scenario Analysis** - Multiple assumption sets

### 📈 Data Analysis
- **Pivot Tables** - Data summarization
- **Charts** - Line, bar, pie, scatter plots
- **Conditional Formatting** - Visual data rules
- **Data Validation** - Input constraints
- **Statistical Functions** - Built-in analysis

### 💳 Expense Tracking
- **Expense Logger** - Track spending by category
- **Budget Management** - Set and monitor budgets
- **Monthly Summaries** - Automatic reports
- **Payment Methods** - Track by card/cash
- **Category Analysis** - Spending patterns

### 🔧 Formula Management
- **Complex Formulas** - VLOOKUP, INDEX/MATCH, etc.
- **Array Formulas** - Multi-cell calculations
- **Custom Functions** - User-defined formulas
- **Formula Auditing** - Dependency tracking

## Quick Start

### Installation

```bash
# Run directly with npx
npx @digitalgreen/sheets-mcp

# Or install globally
npm install -g @digitalgreen/sheets-mcp
```

### Setup (5 minutes)

1. **Get Google Cloud Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create project, enable Sheets & Drive APIs
   - Create OAuth 2.0 credentials (Desktop app)
   - Download credentials JSON

2. **Configure Your AI Assistant**:

**Claude Desktop:**
```json
{
  "mcpServers": {
    "sheets": {
      "command": "npx",
      "args": ["-y", "@digitalgreen/sheets-mcp"],
      "env": {
        "GOOGLE_OAUTH_PATH": "/path/to/your/credentials.json"
      }
    }
  }
}
```

**VS Code (Cline/Continue):**
```json
{
  "mcpServers": {
    "sheets": {
      "command": "npx",
      "args": ["@digitalgreen/sheets-mcp"],
      "env": {
        "GOOGLE_OAUTH_PATH": "/path/to/credentials.json"
      }
    }
  }
}
```

3. **Authenticate**: On first run, authorize the application. Token is saved for future use.

## Usage Examples

### Financial Modeling

```
"Create a 5-year financial model for a SaaS startup with 20% monthly growth"

"Build a DCF valuation model with terminal value calculation"

"Create a unit economics model with CAC, LTV, and payback period"
```

### Expense Tracking

```
"Create an expense tracker with categories for food, transport, and utilities"

"Add today's expenses: $45 lunch, $20 uber, $150 electricity bill"

"Show me spending trends for the last 3 months"
```

### Data Analysis

```
"Create a pivot table summarizing sales by region and product"

"Add a chart showing monthly revenue trends"

"Apply conditional formatting to highlight values above average"
```

### Formula Examples

```
"Add a SUMIF formula to calculate total sales for each region"

"Create a VLOOKUP to match customer IDs with names"

"Build an amortization schedule with PMT formulas"
```

## Available Tools

### Spreadsheet Management
- `sheets_create` - Create new spreadsheet with initial data
- `sheets_read` - Read data from range (with formula support)
- `sheets_write` - Write data to range
- `sheets_list` - List all sheets in spreadsheet
- `sheets_add_sheet` - Add new sheet to existing spreadsheet

### Formula Operations
- `sheets_add_formula` - Add single formula to cell
- `sheets_add_formulas_batch` - Add multiple formulas efficiently

### Financial Modeling
- `sheets_create_financial_model` - Complete P&L, Cash Flow, Balance Sheet
- `sheets_dcf_model` - DCF valuation with terminal value

### Expense Tracking
- `sheets_expense_tracker` - Create categorized expense tracker
- `sheets_add_expense` - Log expense entry with details

### Data Analysis
- `sheets_pivot_table` - Create pivot table for analysis
- `sheets_add_chart` - Add chart visualization

### Formatting
- `sheets_format_range` - Apply cell formatting (colors, borders, number formats)
- `sheets_conditional_format` - Add conditional formatting rules
- `sheets_protect_range` - Protect cells from editing

## Real-World Use Cases

### 1. **Startup Financial Planning**
```javascript
// Create complete financial model
"Create a financial model for my startup with:
- $100k initial revenue
- 15% monthly growth
- 70% gross margin
- 40% operating expenses"
```

### 2. **Personal Budget Tracker**
```javascript
// Set up expense tracking
"Create an expense tracker with:
- Categories: Rent, Food, Transport, Entertainment
- Monthly budgets: $2000, $500, $200, $300
- Track by credit card and cash"
```

### 3. **Sales Dashboard**
```javascript
// Build analytics dashboard
"Create a sales dashboard with:
- Monthly revenue by product
- Regional performance comparison
- YoY growth charts
- Top 10 customers by revenue"
```

### 4. **Investment Portfolio**
```javascript
// Track investments
"Create an investment tracker with:
- Stock positions and cost basis
- Current prices with Google Finance formulas
- P&L calculations
- Asset allocation pie chart"
```

### 5. **Project Budget Management**
```javascript
// Project financial tracking
"Create a project budget tracker with:
- Task breakdown with estimated vs actual costs
- Resource allocation
- Burn rate calculation
- Variance analysis"
```

## Performance Benefits

- **3-5x faster** than document-based approaches
- **Native formula execution** in Sheets engine
- **Batch operations** reduce API calls
- **Direct cell updates** without formatting overhead
- **Built-in calculation engine** for complex models

## Advanced Features

### Complex Financial Models
- Multi-year projections
- Sensitivity analysis
- Monte Carlo simulations
- IRR/NPV calculations
- Loan amortization schedules

### Data Processing
- Import/export CSV data
- Data cleaning and transformation
- Duplicate detection
- Data validation rules
- Cross-sheet references

### Automation
- Recurring expense templates
- Automatic categorization
- Budget alerts
- Scheduled reports
- Data synchronization

## Development

```bash
# Clone repository
git clone https://github.com/eagleisbatman/sheets-mcp.git
cd sheets-mcp

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run development mode
npm run dev

# Test locally
GOOGLE_OAUTH_PATH=/path/to/credentials.json npm start
```

### Project Structure
```
sheets-mcp/
├── src/
│   └── sheets-server.ts    # Main MCP server
├── build/                   # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

## Configuration

### Environment Variables
- `GOOGLE_OAUTH_PATH` - Path to Google OAuth credentials JSON
- `SHEETS_TOKEN_PATH` - Custom token storage location (optional)
- `LOG_LEVEL` - Logging verbosity (debug/info/warn/error)

### Token Storage
Tokens are stored at `~/.docugen/sheets_token.json` by default. This can be customized via environment variables.

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Ensure credentials.json is valid
   - Check API is enabled in Google Cloud Console
   - Verify OAuth consent screen is configured

2. **Permission Denied**
   - Grant spreadsheet edit permissions
   - Check OAuth scopes include sheets and drive

3. **Formula Errors**
   - Use USER_ENTERED input option for formulas
   - Verify formula syntax matches Google Sheets

4. **Rate Limiting**
   - Server implements exponential backoff
   - Batch operations to reduce API calls

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## License

Apache-2.0 - See [LICENSE](LICENSE) file

## Support

- **Issues**: [GitHub Issues](https://github.com/eagleisbatman/sheets-mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/eagleisbatman/sheets-mcp/discussions)

## Author

**Gautam Mandewalker**

---

Built for the MCP ecosystem to enable powerful spreadsheet automation with AI assistants.

Perfect for financial modeling, data analysis, expense tracking, and any spreadsheet automation needs.