#!/usr/bin/env python3
"""
Example: How to use DocuGen MCP Server with Claude Desktop

This example shows what happens when you use DocuGen through Claude Desktop.
The AI (Claude) will use these functions based on your requests.
"""

# Example 1: Creating a Budget Tracker
# User says: "Create a budget tracker for my personal finances"
# Claude will execute:
"""
1. spreadsheet_create(title="Personal Budget Tracker", sheets=["Income", "Expenses", "Summary"])
2. format_cells(range="Income!A1:D1", bold=True, bg_color="#4285F4", text_color="#FFFFFF")
3. values_update(range="Income!A1:D1", values=[["Source", "Amount", "Frequency", "Annual Total"]])
4. validation_add(range="Income!C2:C100", dropdown_values=["Monthly", "Bi-Weekly", "Weekly", "One-Time"])
5. formula_add(range="Income!D2", formula="=IF(C2=\"Monthly\",B2*12,IF(C2=\"Bi-Weekly\",B2*26,IF(C2=\"Weekly\",B2*52,B2)))")
"""

# Example 2: Importing and Analyzing CSV Data
# User says: "I have sales data in CSV format that needs analysis"
# User provides CSV data like:
"""
Date,Product,Quantity,Price,Customer
2024-01-15,Widget A,5,29.99,ABC Corp
2024-01-16,Widget B,3,49.99,XYZ Inc
2024-01-17,Widget A,8,29.99,123 Ltd
"""

# Claude will execute:
"""
1. csv_import(data=csv_content, sheet_name="Sales Data")
2. format_cells(range="A1:E1", bold=True, bg_color="#E8F0FE")
3. range_sort(range="A2:E100", sort_by_column=0)  # Sort by date
4. pivot_table_create(
    source_range="A1:E100",
    pivot_sheet="Analysis",
    rows=["Product"],
    values=["Quantity", "Price"],
    aggregation="SUM"
)
5. chart_create(
    chart_type="COLUMN",
    data_range="Analysis!A1:C10",
    title="Sales by Product"
)
"""

# Example 3: Financial Dashboard
# User says: "Create a financial dashboard for Q4 2024"
# Claude will execute:
"""
1. spreadsheet_create(title="Q4 2024 Financial Dashboard")
2. sheet_add(name="Revenue")
3. sheet_add(name="Expenses")
4. sheet_add(name="Dashboard")

# Set up Revenue sheet
5. values_update(
    range="Revenue!A1:D1",
    values=[["Month", "Projected", "Actual", "Variance"]]
)
6. values_update(
    range="Revenue!A2:A4",
    values=[["October"], ["November"], ["December"]]
)

# Add formulas for variance calculation
7. formula_add(
    range="Revenue!D2:D4",
    formula="=C2-B2"
)

# Apply conditional formatting for variances
8. conditional_format_add(
    range="Revenue!D2:D4",
    rule_type="LESS_THAN",
    value=0,
    format={"bg_color": "#F4CCCC"}  # Red for negative variance
)

# Create summary dashboard
9. formula_add(
    range="Dashboard!B2",
    formula="=SUM(Revenue!C2:C4)"  # Total actual revenue
)
10. chart_create(
    chart_type="LINE",
    data_range="Revenue!A1:C4",
    title="Q4 Revenue Trend",
    sheet_name="Dashboard"
)
"""

# HOW IT WORKS:
# 1. You tell Claude what you want in plain English
# 2. Claude understands your business need
# 3. Claude uses DocuGen functions to build the solution
# 4. You get a professional spreadsheet without writing code

# IMPORTANT NOTES:
# - Claude can't "see" your local CSV files - you need to paste the data
# - Claude works with the spreadsheet IDs that Google provides
# - All operations happen in your Google Sheets account
# - Claude can create, read, update, and format - but not delete spreadsheets

print("This is an example file showing how DocuGen works with Claude Desktop.")
print("You don't run this file - Claude uses the MCP server directly.")
print("Just tell Claude what you want in natural language!")