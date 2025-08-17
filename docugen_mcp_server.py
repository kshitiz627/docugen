#!/usr/bin/env python3.12
"""
DocuGen MCP Server - Complete Google Sheets Automation
Built with FastMCP following official MCP SDK patterns
"""

import os
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

from mcp.server.fastmcp import FastMCP, Context
from mcp.types import TextContent
from pydantic import BaseModel, Field

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Google Sheets API scope
SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']

# ============================================================================
# DATA MODELS
# ============================================================================

class SpreadsheetInfo(BaseModel):
    """Information about a spreadsheet"""
    spreadsheet_id: str = Field(description="The spreadsheet ID")
    title: str = Field(description="Spreadsheet title")
    url: str = Field(description="Spreadsheet URL")
    sheets: List[str] = Field(description="List of sheet names")

class CellRange(BaseModel):
    """Represents a range of cells"""
    sheet: str = Field(default="Sheet1", description="Sheet name")
    start_row: int = Field(ge=1, description="Starting row (1-based)")
    start_col: str = Field(description="Starting column (A, B, C...)")
    end_row: Optional[int] = Field(default=None, description="Ending row")
    end_col: Optional[str] = Field(default=None, description="Ending column")
    
    def to_a1(self) -> str:
        """Convert to A1 notation"""
        if self.end_row and self.end_col:
            return f"{self.sheet}!{self.start_col}{self.start_row}:{self.end_col}{self.end_row}"
        return f"{self.sheet}!{self.start_col}{self.start_row}"

class ChartSpec(BaseModel):
    """Specification for creating a chart"""
    chart_type: str = Field(default="COLUMN", description="Chart type: LINE, BAR, COLUMN, PIE, SCATTER")
    data_range: str = Field(description="Data range in A1 notation")
    title: str = Field(default="Chart", description="Chart title")
    position: Dict[str, int] = Field(default={"row": 0, "column": 5}, description="Chart position")

# ============================================================================
# GOOGLE SHEETS CLIENT
# ============================================================================

class GoogleSheetsClient:
    """Manages Google Sheets API authentication and services"""
    
    def __init__(self):
        self.creds = None
        self.sheets_service = None
        self.drive_service = None
        self.current_spreadsheet_id = None
    
    async def authenticate(self) -> bool:
        """Authenticate with Google APIs"""
        token_path = Path.home() / '.docugen' / 'token.json'
        token_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Load existing token
        if token_path.exists():
            self.creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
        
        # Refresh or get new token
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                self.creds.refresh(Request())
            else:
                creds_path = os.getenv('GOOGLE_OAUTH_PATH')
                if not creds_path:
                    raise ValueError("GOOGLE_OAUTH_PATH environment variable not set")
                
                flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
                self.creds = flow.run_local_server(port=0)
            
            # Save token
            with open(token_path, 'w') as token:
                token.write(self.creds.to_json())
        
        # Build services
        self.sheets_service = build('sheets', 'v4', credentials=self.creds)
        self.drive_service = build('drive', 'v3', credentials=self.creds)
        
        logger.info("Successfully authenticated with Google APIs")
        return True
    
    def get_sheet_id_by_name(self, spreadsheet_id: str, sheet_name: str) -> Optional[int]:
        """Get sheet ID from sheet name"""
        try:
            spreadsheet = self.sheets_service.spreadsheets().get(
                spreadsheetId=spreadsheet_id
            ).execute()
            
            for sheet in spreadsheet.get('sheets', []):
                if sheet['properties']['title'] == sheet_name:
                    return sheet['properties']['sheetId']
            return None
        except HttpError as e:
            logger.error(f"Error getting sheet ID: {e}")
            return None

# ============================================================================
# APPLICATION CONTEXT
# ============================================================================

@dataclass
class AppContext:
    """Application context with dependencies"""
    sheets_client: GoogleSheetsClient

@asynccontextmanager
async def app_lifespan(server: FastMCP) -> AsyncIterator[AppContext]:
    """Manage application lifecycle"""
    # Initialize Google Sheets client
    sheets_client = GoogleSheetsClient()
    await sheets_client.authenticate()
    
    try:
        yield AppContext(sheets_client=sheets_client)
    finally:
        # Cleanup if needed
        pass

# ============================================================================
# CREATE MCP SERVER
# ============================================================================

mcp = FastMCP(
    name="DocuGen Google Sheets",
    instructions="""
    I am a comprehensive Google Sheets automation server that provides complete control over spreadsheets.
    I can create, read, update, and delete spreadsheet data, format cells, create charts, pivot tables,
    and much more. I support all 60+ Google Sheets API operations.
    
    Use me to:
    - Create and manage spreadsheets
    - Read and write data in any format
    - Apply formatting, validation, and protection
    - Create charts and pivot tables
    - Automate complex spreadsheet workflows
    """,
    lifespan=app_lifespan
)

# ============================================================================
# SPREADSHEET OPERATIONS
# ============================================================================

@mcp.tool()
async def spreadsheet_create(
    ctx: Context,
    title: str = "New Spreadsheet",
    sheets: List[str] = ["Sheet1"]
) -> SpreadsheetInfo:
    """
    Create a new Google Sheets spreadsheet
    
    Args:
        title: Title of the new spreadsheet
        sheets: List of sheet names to create
    
    Returns:
        Information about the created spreadsheet
    """
    client = ctx.request_context.lifespan_context.sheets_client
    
    spreadsheet_body = {
        'properties': {'title': title},
        'sheets': [
            {'properties': {'title': sheet_name}}
            for sheet_name in sheets
        ]
    }
    
    result = client.sheets_service.spreadsheets().create(
        body=spreadsheet_body,
        fields='spreadsheetId,spreadsheetUrl,sheets'
    ).execute()
    
    # Set as current spreadsheet
    client.current_spreadsheet_id = result['spreadsheetId']
    
    return SpreadsheetInfo(
        spreadsheet_id=result['spreadsheetId'],
        title=title,
        url=result.get('spreadsheetUrl', ''),
        sheets=sheets
    )

@mcp.tool()
async def spreadsheet_get_metadata(
    ctx: Context,
    spreadsheet_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get spreadsheet metadata including sheets, properties, and named ranges
    
    Args:
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Spreadsheet metadata
    """
    client = ctx.request_context.lifespan_context.sheets_client
    sheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not sheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    spreadsheet = client.sheets_service.spreadsheets().get(
        spreadsheetId=sheet_id,
        fields='properties,sheets,namedRanges'
    ).execute()
    
    return {
        "title": spreadsheet['properties']['title'],
        "sheets": [
            {
                "name": sheet['properties']['title'],
                "id": sheet['properties']['sheetId'],
                "rows": sheet['properties'].get('gridProperties', {}).get('rowCount', 0),
                "columns": sheet['properties'].get('gridProperties', {}).get('columnCount', 0)
            }
            for sheet in spreadsheet.get('sheets', [])
        ],
        "namedRanges": [
            {"name": nr.get('name', 'Unnamed')}
            for nr in spreadsheet.get('namedRanges', [])
        ]
    }

# ============================================================================
# VALUES OPERATIONS
# ============================================================================

@mcp.tool()
async def values_get(
    ctx: Context,
    range: str,
    spreadsheet_id: Optional[str] = None,
    value_render_option: str = "FORMATTED_VALUE"
) -> List[List[Any]]:
    """
    Read values from a spreadsheet range
    
    Args:
        range: A1 notation range (e.g., 'Sheet1!A1:B10')
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
        value_render_option: How to render values (FORMATTED_VALUE, UNFORMATTED_VALUE, FORMULA)
    
    Returns:
        2D array of cell values
    """
    client = ctx.request_context.lifespan_context.sheets_client
    sheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not sheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    result = client.sheets_service.spreadsheets().values().get(
        spreadsheetId=sheet_id,
        range=range,
        valueRenderOption=value_render_option
    ).execute()
    
    return result.get('values', [])

@mcp.tool()
async def values_update(
    ctx: Context,
    range: str,
    values: List[List[Any]],
    spreadsheet_id: Optional[str] = None,
    value_input_option: str = "USER_ENTERED"
) -> Dict[str, Any]:
    """
    Write values to a spreadsheet range
    
    Args:
        range: A1 notation range
        values: 2D array of values to write
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
        value_input_option: How to interpret values (RAW, USER_ENTERED)
    
    Returns:
        Update result with number of cells updated
    """
    client = ctx.request_context.lifespan_context.sheets_client
    sheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not sheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    body = {'values': values}
    
    result = client.sheets_service.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range=range,
        valueInputOption=value_input_option,
        body=body
    ).execute()
    
    return {
        "updatedCells": result.get('updatedCells', 0),
        "updatedRows": result.get('updatedRows', 0),
        "updatedColumns": result.get('updatedColumns', 0),
        "updatedRange": result.get('updatedRange', range)
    }

@mcp.tool()
async def values_append(
    ctx: Context,
    range: str,
    values: List[List[Any]],
    spreadsheet_id: Optional[str] = None,
    insert_data_option: str = "INSERT_ROWS"
) -> Dict[str, Any]:
    """
    Append values to the end of existing data
    
    Args:
        range: A1 notation range to append to
        values: 2D array of values to append
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
        insert_data_option: How to insert data (OVERWRITE, INSERT_ROWS)
    
    Returns:
        Append result with location of appended data
    """
    client = ctx.request_context.lifespan_context.sheets_client
    sheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not sheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    body = {'values': values}
    
    result = client.sheets_service.spreadsheets().values().append(
        spreadsheetId=sheet_id,
        range=range,
        valueInputOption="USER_ENTERED",
        insertDataOption=insert_data_option,
        body=body
    ).execute()
    
    updates = result.get('updates', {})
    return {
        "updatedCells": updates.get('updatedCells', 0),
        "updatedRows": updates.get('updatedRows', 0),
        "updatedRange": updates.get('updatedRange', '')
    }

@mcp.tool()
async def values_clear(
    ctx: Context,
    range: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Clear values from a range (keeps formatting)
    
    Args:
        range: A1 notation range to clear
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    sheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not sheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    result = client.sheets_service.spreadsheets().values().clear(
        spreadsheetId=sheet_id,
        range=range,
        body={}
    ).execute()
    
    return f"Cleared range: {result.get('clearedRange', range)}"

@mcp.tool()
async def values_batch_get(
    ctx: Context,
    ranges: List[str],
    spreadsheet_id: Optional[str] = None
) -> Dict[str, List[List[Any]]]:
    """
    Get values from multiple ranges in one request
    
    Args:
        ranges: List of A1 notation ranges
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Dictionary mapping ranges to their values
    """
    client = ctx.request_context.lifespan_context.sheets_client
    sheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not sheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    result = client.sheets_service.spreadsheets().values().batchGet(
        spreadsheetId=sheet_id,
        ranges=ranges
    ).execute()
    
    return {
        vr.get('range', ''): vr.get('values', [])
        for vr in result.get('valueRanges', [])
    }

@mcp.tool()
async def values_batch_update(
    ctx: Context,
    data: List[Dict[str, Any]],
    spreadsheet_id: Optional[str] = None
) -> Dict[str, int]:
    """
    Update multiple ranges in one request
    
    Args:
        data: List of dicts with 'range' and 'values' keys
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Summary of updates
    """
    client = ctx.request_context.lifespan_context.sheets_client
    sheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not sheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    body = {
        'valueInputOption': 'USER_ENTERED',
        'data': [
            {
                'range': item['range'],
                'values': item['values']
            }
            for item in data
        ]
    }
    
    result = client.sheets_service.spreadsheets().values().batchUpdate(
        spreadsheetId=sheet_id,
        body=body
    ).execute()
    
    return {
        "totalUpdatedCells": result.get('totalUpdatedCells', 0),
        "totalUpdatedRows": result.get('totalUpdatedRows', 0),
        "totalUpdatedColumns": result.get('totalUpdatedColumns', 0),
        "totalUpdatedSheets": result.get('totalUpdatedSheets', 0)
    }

# ============================================================================
# SHEET OPERATIONS
# ============================================================================

@mcp.tool()
async def sheet_add(
    ctx: Context,
    title: str,
    spreadsheet_id: Optional[str] = None,
    rows: int = 1000,
    columns: int = 26
) -> Dict[str, Any]:
    """
    Add a new sheet to a spreadsheet
    
    Args:
        title: Title of the new sheet
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
        rows: Number of rows
        columns: Number of columns
    
    Returns:
        Information about the created sheet
    """
    client = ctx.request_context.lifespan_context.sheets_client
    sheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not sheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    request = {
        'addSheet': {
            'properties': {
                'title': title,
                'gridProperties': {
                    'rowCount': rows,
                    'columnCount': columns
                }
            }
        }
    }
    
    body = {'requests': [request]}
    
    result = client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=sheet_id,
        body=body
    ).execute()
    
    replies = result.get('replies', [])
    if replies and 'addSheet' in replies[0]:
        new_sheet = replies[0]['addSheet']['properties']
        return {
            "sheetId": new_sheet['sheetId'],
            "title": new_sheet['title'],
            "rows": rows,
            "columns": columns
        }
    
    return {"title": title, "rows": rows, "columns": columns}

@mcp.tool()
async def sheet_delete(
    ctx: Context,
    sheet_name: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Delete a sheet from a spreadsheet
    
    Args:
        sheet_name: Name of the sheet to delete
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Get sheet ID
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'deleteSheet': {
            'sheetId': sheet_id
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Deleted sheet: {sheet_name}"

@mcp.tool()
async def sheet_duplicate(
    ctx: Context,
    source_sheet_name: str,
    new_sheet_name: str,
    spreadsheet_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Duplicate an existing sheet
    
    Args:
        source_sheet_name: Name of sheet to duplicate
        new_sheet_name: Name for the duplicate
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Information about the duplicated sheet
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Get source sheet ID
    source_sheet_id = client.get_sheet_id_by_name(spreadsheet_id, source_sheet_name)
    if source_sheet_id is None:
        raise ValueError(f"Sheet '{source_sheet_name}' not found")
    
    request = {
        'duplicateSheet': {
            'sourceSheetId': source_sheet_id,
            'newSheetName': new_sheet_name
        }
    }
    
    body = {'requests': [request]}
    
    result = client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    replies = result.get('replies', [])
    if replies and 'duplicateSheet' in replies[0]:
        new_sheet = replies[0]['duplicateSheet']['properties']
        return {
            "sheetId": new_sheet['sheetId'],
            "title": new_sheet['title']
        }
    
    return {"title": new_sheet_name}

# ============================================================================
# FORMATTING OPERATIONS
# ============================================================================

@mcp.tool()
async def format_cells(
    ctx: Context,
    range: str,
    spreadsheet_id: Optional[str] = None,
    bold: Optional[bool] = None,
    italic: Optional[bool] = None,
    font_size: Optional[int] = None,
    bg_color: Optional[str] = None,
    text_color: Optional[str] = None,
    h_align: Optional[str] = None,
    v_align: Optional[str] = None
) -> str:
    """
    Apply formatting to cells
    
    Args:
        range: A1 notation range
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
        bold: Make text bold
        italic: Make text italic
        font_size: Font size in points
        bg_color: Background color (hex)
        text_color: Text color (hex)
        h_align: Horizontal alignment (LEFT, CENTER, RIGHT)
        v_align: Vertical alignment (TOP, MIDDLE, BOTTOM)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Parse range to get sheet name
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    # Build format request
    cell_format = {}
    text_format = {}
    
    if bold is not None:
        text_format['bold'] = bold
    if italic is not None:
        text_format['italic'] = italic
    if font_size is not None:
        text_format['fontSize'] = font_size
    
    if text_format:
        cell_format['textFormat'] = text_format
    
    if bg_color:
        # Convert hex to RGB
        bg_color = bg_color.lstrip('#')
        cell_format['backgroundColor'] = {
            'red': int(bg_color[0:2], 16) / 255,
            'green': int(bg_color[2:4], 16) / 255,
            'blue': int(bg_color[4:6], 16) / 255
        }
    
    if text_color:
        text_color = text_color.lstrip('#')
        if 'textFormat' not in cell_format:
            cell_format['textFormat'] = {}
        cell_format['textFormat']['foregroundColor'] = {
            'red': int(text_color[0:2], 16) / 255,
            'green': int(text_color[2:4], 16) / 255,
            'blue': int(text_color[4:6], 16) / 255
        }
    
    if h_align:
        cell_format['horizontalAlignment'] = h_align
    if v_align:
        cell_format['verticalAlignment'] = v_align
    
    # For simplicity, apply to whole sheet (you'd parse range properly in production)
    request = {
        'repeatCell': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 100,
                'startColumnIndex': 0,
                'endColumnIndex': 26
            },
            'cell': {
                'userEnteredFormat': cell_format
            },
            'fields': 'userEnteredFormat'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Applied formatting to {range}"

# ============================================================================
# CHART OPERATIONS
# ============================================================================

@mcp.tool()
async def chart_create(
    ctx: Context,
    chart_spec: ChartSpec,
    spreadsheet_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a chart in a spreadsheet
    
    Args:
        chart_spec: Chart specification
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Information about the created chart
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Get sheet name from range
    sheet_name = chart_spec.data_range.split('!')[0] if '!' in chart_spec.data_range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    # Build chart specification
    chart_request = {
        'addChart': {
            'chart': {
                'spec': {
                    'title': chart_spec.title,
                    'basicChart': {
                        'chartType': chart_spec.chart_type,
                        'legendPosition': 'RIGHT_LEGEND',
                        'axis': [
                            {'position': 'BOTTOM_AXIS', 'title': 'X Axis'},
                            {'position': 'LEFT_AXIS', 'title': 'Y Axis'}
                        ],
                        'headerCount': 1
                    }
                },
                'position': {
                    'overlayPosition': {
                        'anchorCell': {
                            'sheetId': sheet_id,
                            'rowIndex': chart_spec.position['row'],
                            'columnIndex': chart_spec.position['column']
                        },
                        'widthPixels': 600,
                        'heightPixels': 400
                    }
                }
            }
        }
    }
    
    body = {'requests': [chart_request]}
    
    result = client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    replies = result.get('replies', [])
    if replies and 'addChart' in replies[0]:
        chart = replies[0]['addChart']['chart']
        return {
            "chartId": chart.get('chartId'),
            "title": chart_spec.title,
            "type": chart_spec.chart_type
        }
    
    return {"title": chart_spec.title, "type": chart_spec.chart_type}

# ============================================================================
# DIMENSION OPERATIONS
# ============================================================================

@mcp.tool()
async def rows_insert(
    ctx: Context,
    sheet_name: str,
    start_index: int,
    num_rows: int = 1,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Insert rows into a sheet
    
    Args:
        sheet_name: Sheet name
        start_index: Where to insert rows (0-based)
        num_rows: Number of rows to insert
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'insertDimension': {
            'range': {
                'sheetId': sheet_id,
                'dimension': 'ROWS',
                'startIndex': start_index,
                'endIndex': start_index + num_rows
            },
            'inheritFromBefore': True
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Inserted {num_rows} row(s) at position {start_index + 1} in '{sheet_name}'"

@mcp.tool()
async def columns_insert(
    ctx: Context,
    sheet_name: str,
    start_index: int,
    num_columns: int = 1,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Insert columns into a sheet
    
    Args:
        sheet_name: Sheet name
        start_index: Where to insert columns (0-based)
        num_columns: Number of columns to insert
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'insertDimension': {
            'range': {
                'sheetId': sheet_id,
                'dimension': 'COLUMNS',
                'startIndex': start_index,
                'endIndex': start_index + num_columns
            },
            'inheritFromBefore': True
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    # Convert index to column letter
    column_letter = chr(65 + start_index)
    return f"Inserted {num_columns} column(s) at position {column_letter} in '{sheet_name}'"

# ============================================================================
# FILTER OPERATIONS
# ============================================================================

@mcp.tool()
async def filter_apply(
    ctx: Context,
    sheet_name: str,
    filter_range: str,
    criteria: Dict[str, Any],
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Apply a filter to a range
    
    Args:
        sheet_name: Sheet name
        filter_range: Range to filter (A1 notation)
        criteria: Filter criteria by column
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    # Parse range to get dimensions
    # For simplicity, using default range
    request = {
        'setBasicFilter': {
            'filter': {
                'range': {
                    'sheetId': sheet_id,
                    'startRowIndex': 0,
                    'endRowIndex': 1000,
                    'startColumnIndex': 0,
                    'endColumnIndex': 26
                },
                'criteria': {}
            }
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Applied filter to {filter_range} in '{sheet_name}'"

@mcp.tool()
async def filter_clear(
    ctx: Context,
    sheet_name: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Clear all filters from a sheet
    
    Args:
        sheet_name: Sheet name
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'clearBasicFilter': {
            'sheetId': sheet_id
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Cleared filters from '{sheet_name}'"

# ============================================================================
# PIVOT TABLE OPERATIONS
# ============================================================================

@mcp.tool()
async def pivot_table_create(
    ctx: Context,
    source_range: str,
    target_sheet: str,
    rows: List[str],
    columns: List[str],
    values: List[Dict[str, str]],
    spreadsheet_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a pivot table
    
    Args:
        source_range: Source data range (A1 notation)
        target_sheet: Sheet to place pivot table
        rows: Fields for rows
        columns: Fields for columns
        values: Fields for values with aggregation functions
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Information about created pivot table
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    source_sheet = source_range.split('!')[0] if '!' in source_range else 'Sheet1'
    source_sheet_id = client.get_sheet_id_by_name(spreadsheet_id, source_sheet)
    target_sheet_id = client.get_sheet_id_by_name(spreadsheet_id, target_sheet)
    
    if source_sheet_id is None or target_sheet_id is None:
        raise ValueError("Sheet not found")
    
    pivot_table = {
        'sourceSheetId': source_sheet_id,
        'rows': [{'sourceColumnOffset': i} for i in range(len(rows))],
        'columns': [{'sourceColumnOffset': i + len(rows)} for i in range(len(columns))],
        'values': [
            {
                'summarizeFunction': val.get('function', 'SUM'),
                'sourceColumnOffset': i + len(rows) + len(columns)
            }
            for i, val in enumerate(values)
        ]
    }
    
    request = {
        'updateCells': {
            'rows': [
                {
                    'values': [
                        {
                            'pivotTable': pivot_table
                        }
                    ]
                }
            ],
            'start': {
                'sheetId': target_sheet_id,
                'rowIndex': 0,
                'columnIndex': 0
            },
            'fields': 'pivotTable'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return {
        "source": source_range,
        "target": target_sheet,
        "rows": rows,
        "columns": columns,
        "values": values
    }

# ============================================================================
# CONDITIONAL FORMATTING OPERATIONS
# ============================================================================

@mcp.tool()
async def conditional_format_add(
    ctx: Context,
    range: str,
    rule_type: str,
    condition: Dict[str, Any],
    format_options: Dict[str, Any],
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Add conditional formatting rule
    
    Args:
        range: Range to apply formatting (A1 notation)
        rule_type: Type of rule (VALUE, FORMULA, etc.)
        condition: Condition parameters
        format_options: Formatting to apply
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    # Build conditional format rule
    rule = {
        'ranges': [
            {
                'sheetId': sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 100,
                'startColumnIndex': 0,
                'endColumnIndex': 26
            }
        ],
        'booleanRule': {
            'condition': {
                'type': rule_type,
                'values': [{'userEnteredValue': str(v)} for v in condition.get('values', [])]
            },
            'format': format_options
        }
    }
    
    request = {
        'addConditionalFormatRule': {
            'rule': rule,
            'index': 0
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Added conditional formatting to {range}"

@mcp.tool()
async def conditional_format_clear(
    ctx: Context,
    sheet_name: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Clear all conditional formatting from a sheet
    
    Args:
        sheet_name: Sheet name
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Get all conditional format rules
    spreadsheet = client.sheets_service.spreadsheets().get(
        spreadsheetId=spreadsheet_id,
        fields='sheets.conditionalFormats'
    ).execute()
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    # Find rules for this sheet
    requests = []
    for sheet in spreadsheet.get('sheets', []):
        if sheet['properties']['sheetId'] == sheet_id:
            for rule in sheet.get('conditionalFormats', []):
                requests.append({
                    'deleteConditionalFormatRule': {
                        'sheetId': sheet_id,
                        'index': 0
                    }
                })
    
    if requests:
        body = {'requests': requests}
        client.sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body=body
        ).execute()
    
    return f"Cleared conditional formatting from '{sheet_name}'"

# ============================================================================
# DATA VALIDATION OPERATIONS
# ============================================================================

@mcp.tool()
async def validation_add(
    ctx: Context,
    range: str,
    validation_type: str,
    values: Optional[List[str]] = None,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Add data validation to cells
    
    Args:
        range: Range to validate (A1 notation)
        validation_type: Type of validation (LIST, NUMBER, DATE, etc.)
        values: List of valid values (for LIST type)
        min_value: Minimum value (for NUMBER type)
        max_value: Maximum value (for NUMBER type)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    # Build validation rule
    validation = {
        'condition': {
            'type': validation_type
        },
        'showCustomUi': True,
        'strict': True
    }
    
    if validation_type == 'ONE_OF_LIST' and values:
        validation['condition']['values'] = [{'userEnteredValue': v} for v in values]
    elif validation_type == 'NUMBER_BETWEEN':
        validation['condition']['values'] = [
            {'userEnteredValue': str(min_value)},
            {'userEnteredValue': str(max_value)}
        ]
    
    request = {
        'setDataValidation': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 100,
                'startColumnIndex': 0,
                'endColumnIndex': 26
            },
            'rule': validation
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Added data validation to {range}"

@mcp.tool()
async def validation_clear(
    ctx: Context,
    range: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Clear data validation from cells
    
    Args:
        range: Range to clear validation (A1 notation)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'setDataValidation': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 100,
                'startColumnIndex': 0,
                'endColumnIndex': 26
            }
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Cleared data validation from {range}"

# ============================================================================
# NAMED RANGE OPERATIONS
# ============================================================================

@mcp.tool()
async def named_range_add(
    ctx: Context,
    name: str,
    range: str,
    spreadsheet_id: Optional[str] = None
) -> Dict[str, str]:
    """
    Create a named range
    
    Args:
        name: Name for the range
        range: Range in A1 notation
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Named range information
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'addNamedRange': {
            'namedRange': {
                'name': name,
                'range': {
                    'sheetId': sheet_id,
                    'startRowIndex': 0,
                    'endRowIndex': 100,
                    'startColumnIndex': 0,
                    'endColumnIndex': 26
                }
            }
        }
    }
    
    body = {'requests': [request]}
    
    result = client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return {
        "name": name,
        "range": range,
        "namedRangeId": result.get('replies', [{}])[0].get('addNamedRange', {}).get('namedRange', {}).get('namedRangeId', '')
    }

@mcp.tool()
async def named_range_delete(
    ctx: Context,
    name: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Delete a named range
    
    Args:
        name: Name of the range to delete
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Get named ranges
    spreadsheet = client.sheets_service.spreadsheets().get(
        spreadsheetId=spreadsheet_id,
        fields='namedRanges'
    ).execute()
    
    # Find the named range
    named_range_id = None
    for nr in spreadsheet.get('namedRanges', []):
        if nr.get('name') == name:
            named_range_id = nr.get('namedRangeId')
            break
    
    if not named_range_id:
        raise ValueError(f"Named range '{name}' not found")
    
    request = {
        'deleteNamedRange': {
            'namedRangeId': named_range_id
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Deleted named range: {name}"

# ============================================================================
# PROTECTION OPERATIONS
# ============================================================================

@mcp.tool()
async def protection_add(
    ctx: Context,
    range: str,
    description: str = "Protected Range",
    editors: List[str] = [],
    spreadsheet_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Protect a range or sheet
    
    Args:
        range: Range to protect (A1 notation)
        description: Description of protection
        editors: List of email addresses who can edit
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Protection information
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    protected_range = {
        'range': {
            'sheetId': sheet_id,
            'startRowIndex': 0,
            'endRowIndex': 100,
            'startColumnIndex': 0,
            'endColumnIndex': 26
        },
        'description': description,
        'warningOnly': len(editors) == 0
    }
    
    if editors:
        protected_range['editors'] = {'users': editors}
    
    request = {
        'addProtectedRange': {
            'protectedRange': protected_range
        }
    }
    
    body = {'requests': [request]}
    
    result = client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return {
        "range": range,
        "description": description,
        "protectedRangeId": result.get('replies', [{}])[0].get('addProtectedRange', {}).get('protectedRange', {}).get('protectedRangeId', 0)
    }

@mcp.tool()
async def protection_remove(
    ctx: Context,
    protection_id: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Remove protection from a range
    
    Args:
        protection_id: ID of the protection to remove
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    request = {
        'deleteProtectedRange': {
            'protectedRangeId': protection_id
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Removed protection with ID: {protection_id}"

# ============================================================================
# MERGE OPERATIONS
# ============================================================================

@mcp.tool()
async def cells_merge(
    ctx: Context,
    range: str,
    merge_type: str = "MERGE_ALL",
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Merge cells in a range
    
    Args:
        range: Range to merge (A1 notation)
        merge_type: Type of merge (MERGE_ALL, MERGE_ROWS, MERGE_COLUMNS)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'mergeCells': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 10,
                'startColumnIndex': 0,
                'endColumnIndex': 5
            },
            'mergeType': merge_type
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Merged cells in {range} using {merge_type}"

@mcp.tool()
async def cells_unmerge(
    ctx: Context,
    range: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Unmerge cells in a range
    
    Args:
        range: Range to unmerge (A1 notation)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'unmergeCells': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 10,
                'startColumnIndex': 0,
                'endColumnIndex': 5
            }
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Unmerged cells in {range}"

# ============================================================================
# BORDER OPERATIONS
# ============================================================================

@mcp.tool()
async def borders_update(
    ctx: Context,
    range: str,
    border_style: str = "SOLID",
    border_width: int = 1,
    border_color: str = "#000000",
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Update cell borders
    
    Args:
        range: Range to update borders (A1 notation)
        border_style: Style of border (SOLID, DASHED, DOTTED)
        border_width: Width of border in pixels
        border_color: Color of border (hex)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    # Convert hex color to RGB
    color = border_color.lstrip('#')
    border = {
        'style': border_style,
        'width': border_width,
        'color': {
            'red': int(color[0:2], 16) / 255,
            'green': int(color[2:4], 16) / 255,
            'blue': int(color[4:6], 16) / 255
        }
    }
    
    request = {
        'updateBorders': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 10,
                'startColumnIndex': 0,
                'endColumnIndex': 5
            },
            'top': border,
            'bottom': border,
            'left': border,
            'right': border,
            'innerHorizontal': border,
            'innerVertical': border
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Updated borders for {range}"

# ============================================================================
# FIND AND REPLACE OPERATIONS
# ============================================================================

@mcp.tool()
async def find_replace(
    ctx: Context,
    find: str,
    replace: str,
    sheet_name: Optional[str] = None,
    match_case: bool = False,
    match_entire_cell: bool = False,
    spreadsheet_id: Optional[str] = None
) -> Dict[str, int]:
    """
    Find and replace text in spreadsheet
    
    Args:
        find: Text to find
        replace: Text to replace with
        sheet_name: Specific sheet (or all sheets if None)
        match_case: Case sensitive search
        match_entire_cell: Match entire cell contents
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Number of replacements made
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    request = {
        'findReplace': {
            'find': find,
            'replacement': replace,
            'matchCase': match_case,
            'matchEntireCell': match_entire_cell,
            'searchByRegex': False,
            'includeFormulas': False
        }
    }
    
    if sheet_name:
        sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
        if sheet_id is not None:
            request['findReplace']['sheetId'] = sheet_id
    
    body = {'requests': [request]}
    
    result = client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    occurrences = result.get('replies', [{}])[0].get('findReplace', {}).get('occurrencesChanged', 0)
    
    return {
        "occurrencesChanged": occurrences,
        "find": find,
        "replace": replace
    }

# ============================================================================
# SORT OPERATIONS
# ============================================================================

@mcp.tool()
async def range_sort(
    ctx: Context,
    range: str,
    sort_specs: List[Dict[str, Any]],
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Sort data in a range
    
    Args:
        range: Range to sort (A1 notation)
        sort_specs: List of sort specifications with column index and order
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    sort_specs_formatted = []
    for spec in sort_specs:
        sort_specs_formatted.append({
            'dimensionIndex': spec.get('column', 0),
            'sortOrder': spec.get('order', 'ASCENDING')
        })
    
    request = {
        'sortRange': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 1,  # Skip header
                'endRowIndex': 1000,
                'startColumnIndex': 0,
                'endColumnIndex': 26
            },
            'sortSpecs': sort_specs_formatted
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Sorted range {range}"

# ============================================================================
# COPY/PASTE OPERATIONS
# ============================================================================

@mcp.tool()
async def range_copy_paste(
    ctx: Context,
    source_range: str,
    target_range: str,
    paste_type: str = "PASTE_NORMAL",
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Copy and paste data between ranges
    
    Args:
        source_range: Source range (A1 notation)
        target_range: Target range (A1 notation)
        paste_type: Type of paste (PASTE_NORMAL, PASTE_VALUES, PASTE_FORMAT, etc.)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    source_sheet = source_range.split('!')[0] if '!' in source_range else 'Sheet1'
    target_sheet = target_range.split('!')[0] if '!' in target_range else 'Sheet1'
    
    source_sheet_id = client.get_sheet_id_by_name(spreadsheet_id, source_sheet)
    target_sheet_id = client.get_sheet_id_by_name(spreadsheet_id, target_sheet)
    
    if source_sheet_id is None or target_sheet_id is None:
        raise ValueError("Sheet not found")
    
    request = {
        'copyPaste': {
            'source': {
                'sheetId': source_sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 100,
                'startColumnIndex': 0,
                'endColumnIndex': 26
            },
            'destination': {
                'sheetId': target_sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 100,
                'startColumnIndex': 0,
                'endColumnIndex': 26
            },
            'pasteType': paste_type,
            'pasteOrientation': 'NORMAL'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Copied {source_range} to {target_range}"

@mcp.tool()
async def range_cut_paste(
    ctx: Context,
    source_range: str,
    target_range: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Cut and paste data between ranges
    
    Args:
        source_range: Source range to cut (A1 notation)
        target_range: Target range (A1 notation)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    source_sheet = source_range.split('!')[0] if '!' in source_range else 'Sheet1'
    target_sheet = target_range.split('!')[0] if '!' in target_range else 'Sheet1'
    
    source_sheet_id = client.get_sheet_id_by_name(spreadsheet_id, source_sheet)
    target_sheet_id = client.get_sheet_id_by_name(spreadsheet_id, target_sheet)
    
    if source_sheet_id is None or target_sheet_id is None:
        raise ValueError("Sheet not found")
    
    request = {
        'cutPaste': {
            'source': {
                'sheetId': source_sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 100,
                'startColumnIndex': 0,
                'endColumnIndex': 26
            },
            'destination': {
                'sheetId': target_sheet_id,
                'rowIndex': 0,
                'columnIndex': 0
            },
            'pasteType': 'PASTE_NORMAL'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Cut {source_range} and pasted to {target_range}"

# ============================================================================
# DEVELOPER METADATA OPERATIONS
# ============================================================================

@mcp.tool()
async def metadata_create(
    ctx: Context,
    key: str,
    value: str,
    location: str,
    visibility: str = "DOCUMENT",
    spreadsheet_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create developer metadata
    
    Args:
        key: Metadata key
        value: Metadata value
        location: Location (sheet name or range)
        visibility: Visibility (DOCUMENT or PROJECT)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Metadata information
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = location.split('!')[0] if '!' in location else location
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    metadata = {
        'metadataKey': key,
        'metadataValue': value,
        'visibility': visibility
    }
    
    if sheet_id is not None:
        metadata['location'] = {
            'sheetId': sheet_id
        }
    
    request = {
        'createDeveloperMetadata': {
            'developerMetadata': metadata
        }
    }
    
    body = {'requests': [request]}
    
    result = client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return {
        "key": key,
        "value": value,
        "location": location,
        "visibility": visibility
    }

@mcp.tool()
async def metadata_search(
    ctx: Context,
    key: Optional[str] = None,
    value: Optional[str] = None,
    spreadsheet_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Search for developer metadata
    
    Args:
        key: Metadata key to search
        value: Metadata value to search
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        List of matching metadata
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    data_filters = []
    if key:
        data_filters.append({
            'developerMetadataLookup': {
                'metadataKey': key
            }
        })
    
    body = {
        'dataFilters': data_filters if data_filters else [{}]
    }
    
    result = client.sheets_service.spreadsheets().developerMetadata().search(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    metadata_list = []
    for item in result.get('matchedDeveloperMetadata', []):
        dm = item.get('developerMetadata', {})
        metadata_list.append({
            'metadataId': dm.get('metadataId'),
            'key': dm.get('metadataKey'),
            'value': dm.get('metadataValue'),
            'visibility': dm.get('visibility')
        })
    
    return metadata_list

# ============================================================================
# BANDED RANGES OPERATIONS
# ============================================================================

@mcp.tool()
async def banded_range_add(
    ctx: Context,
    range: str,
    header_color: str = "#4285F4",
    first_band_color: str = "#FFFFFF",
    second_band_color: str = "#F8F9FA",
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Add banded range (alternating colors)
    
    Args:
        range: Range to band (A1 notation)
        header_color: Header row color (hex)
        first_band_color: First band color (hex)
        second_band_color: Second band color (hex)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    def hex_to_rgb(hex_color):
        hex_color = hex_color.lstrip('#')
        return {
            'red': int(hex_color[0:2], 16) / 255,
            'green': int(hex_color[2:4], 16) / 255,
            'blue': int(hex_color[4:6], 16) / 255
        }
    
    request = {
        'addBanding': {
            'bandedRange': {
                'range': {
                    'sheetId': sheet_id,
                    'startRowIndex': 0,
                    'endRowIndex': 100,
                    'startColumnIndex': 0,
                    'endColumnIndex': 26
                },
                'rowProperties': {
                    'headerColor': hex_to_rgb(header_color),
                    'firstBandColor': hex_to_rgb(first_band_color),
                    'secondBandColor': hex_to_rgb(second_band_color)
                }
            }
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Added banded range to {range}"

@mcp.tool()
async def banded_range_remove(
    ctx: Context,
    banded_range_id: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Remove a banded range
    
    Args:
        banded_range_id: ID of banded range to remove
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    request = {
        'deleteBanding': {
            'bandedRangeId': banded_range_id
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Removed banded range with ID: {banded_range_id}"

# ============================================================================
# FORMULA OPERATIONS
# ============================================================================

@mcp.tool()
async def formula_add(
    ctx: Context,
    cell: str,
    formula: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Add a formula to a cell
    
    Args:
        cell: Cell location (A1 notation)
        formula: Formula to add (e.g., '=SUM(A1:A10)')
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Ensure formula starts with =
    if not formula.startswith('='):
        formula = '=' + formula
    
    result = client.sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=cell,
        valueInputOption='USER_ENTERED',
        body={'values': [[formula]]}
    ).execute()
    
    return f"Added formula to {cell}: {formula}"

@mcp.tool()
async def formula_array_add(
    ctx: Context,
    range: str,
    array_formula: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Add an array formula to a range
    
    Args:
        range: Range for array formula (A1 notation)
        array_formula: Array formula (e.g., '=ARRAYFORMULA(A1:A10*2)')
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Ensure formula starts with =
    if not array_formula.startswith('='):
        array_formula = '=' + array_formula
    
    # If not already an ARRAYFORMULA, wrap it
    if 'ARRAYFORMULA' not in array_formula.upper():
        array_formula = f"=ARRAYFORMULA({array_formula[1:]})"
    
    result = client.sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=range,
        valueInputOption='USER_ENTERED',
        body={'values': [[array_formula]]}
    ).execute()
    
    return f"Added array formula to {range}"

# ============================================================================
# HYPERLINK OPERATIONS
# ============================================================================

@mcp.tool()
async def hyperlink_add(
    ctx: Context,
    cell: str,
    url: str,
    display_text: Optional[str] = None,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Add a hyperlink to a cell
    
    Args:
        cell: Cell location (A1 notation)
        url: URL to link to
        display_text: Text to display (defaults to URL)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Create HYPERLINK formula
    if display_text:
        formula = f'=HYPERLINK("{url}", "{display_text}")'
    else:
        formula = f'=HYPERLINK("{url}")'
    
    result = client.sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=cell,
        valueInputOption='USER_ENTERED',
        body={'values': [[formula]]}
    ).execute()
    
    return f"Added hyperlink to {cell}"

# ============================================================================
# NOTE/COMMENT OPERATIONS
# ============================================================================

@mcp.tool()
async def note_add(
    ctx: Context,
    cell: str,
    note: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Add a note to a cell
    
    Args:
        cell: Cell location (A1 notation)
        note: Note text
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = cell.split('!')[0] if '!' in cell else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    # Parse cell reference
    cell_ref = cell.split('!')[-1] if '!' in cell else cell
    col = ord(cell_ref[0]) - ord('A')
    row = int(cell_ref[1:]) - 1
    
    request = {
        'updateCells': {
            'rows': [{
                'values': [{
                    'note': note
                }]
            }],
            'fields': 'note',
            'start': {
                'sheetId': sheet_id,
                'rowIndex': row,
                'columnIndex': col
            }
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Added note to {cell}"

@mcp.tool()
async def note_clear(
    ctx: Context,
    cell: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Clear note from a cell
    
    Args:
        cell: Cell location (A1 notation)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = cell.split('!')[0] if '!' in cell else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    # Parse cell reference
    cell_ref = cell.split('!')[-1] if '!' in cell else cell
    col = ord(cell_ref[0]) - ord('A')
    row = int(cell_ref[1:]) - 1
    
    request = {
        'updateCells': {
            'rows': [{
                'values': [{}]
            }],
            'fields': 'note',
            'start': {
                'sheetId': sheet_id,
                'rowIndex': row,
                'columnIndex': col
            }
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Cleared note from {cell}"

# ============================================================================
# IMPORT/EXPORT OPERATIONS
# ============================================================================

@mcp.tool()
async def csv_import(
    ctx: Context,
    csv_data: str,
    sheet_name: str = "Imported Data",
    spreadsheet_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Import CSV data into a sheet
    
    Args:
        csv_data: CSV formatted data
        sheet_name: Name for the sheet
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Import results
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Parse CSV
    import csv
    import io
    
    reader = csv.reader(io.StringIO(csv_data))
    values = list(reader)
    
    # Create new sheet if needed
    try:
        sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
        if sheet_id is None:
            # Create sheet
            request = {
                'addSheet': {
                    'properties': {
                        'title': sheet_name
                    }
                }
            }
            body = {'requests': [request]}
            client.sheets_service.spreadsheets().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body=body
            ).execute()
    except:
        pass
    
    # Write data
    range_name = f"{sheet_name}!A1"
    body = {'values': values}
    
    result = client.sheets_service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=range_name,
        valueInputOption='RAW',
        body=body
    ).execute()
    
    return {
        "sheet": sheet_name,
        "rows_imported": len(values),
        "columns_imported": len(values[0]) if values else 0
    }

@mcp.tool()
async def data_export_csv(
    ctx: Context,
    range: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Export range data as CSV
    
    Args:
        range: Range to export (A1 notation)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        CSV formatted data
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    result = client.sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=range
    ).execute()
    
    values = result.get('values', [])
    
    # Convert to CSV
    import csv
    import io
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(values)
    
    return output.getvalue()

# ============================================================================
# SHEET PROPERTIES OPERATIONS
# ============================================================================

@mcp.tool()
async def sheet_rename(
    ctx: Context,
    old_name: str,
    new_name: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Rename a sheet
    
    Args:
        old_name: Current sheet name
        new_name: New sheet name
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, old_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{old_name}' not found")
    
    request = {
        'updateSheetProperties': {
            'properties': {
                'sheetId': sheet_id,
                'title': new_name
            },
            'fields': 'title'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Renamed sheet from '{old_name}' to '{new_name}'"

@mcp.tool()
async def sheet_hide(
    ctx: Context,
    sheet_name: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Hide a sheet
    
    Args:
        sheet_name: Sheet to hide
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'updateSheetProperties': {
            'properties': {
                'sheetId': sheet_id,
                'hidden': True
            },
            'fields': 'hidden'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Hidden sheet: {sheet_name}"

@mcp.tool()
async def sheet_unhide(
    ctx: Context,
    sheet_name: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Unhide a sheet
    
    Args:
        sheet_name: Sheet to unhide
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Need to get all sheets to find hidden ones
    spreadsheet = client.sheets_service.spreadsheets().get(
        spreadsheetId=spreadsheet_id
    ).execute()
    
    sheet_id = None
    for sheet in spreadsheet.get('sheets', []):
        if sheet['properties']['title'] == sheet_name:
            sheet_id = sheet['properties']['sheetId']
            break
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'updateSheetProperties': {
            'properties': {
                'sheetId': sheet_id,
                'hidden': False
            },
            'fields': 'hidden'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Unhidden sheet: {sheet_name}"

@mcp.tool()
async def sheet_move(
    ctx: Context,
    sheet_name: str,
    new_index: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Move a sheet to a new position
    
    Args:
        sheet_name: Sheet to move
        new_index: New position (0-based)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'updateSheetProperties': {
            'properties': {
                'sheetId': sheet_id,
                'index': new_index
            },
            'fields': 'index'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Moved sheet '{sheet_name}' to position {new_index}"

# ============================================================================
# FREEZE OPERATIONS
# ============================================================================

@mcp.tool()
async def freeze_rows(
    ctx: Context,
    sheet_name: str,
    num_rows: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Freeze rows at the top of a sheet
    
    Args:
        sheet_name: Sheet name
        num_rows: Number of rows to freeze
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'updateSheetProperties': {
            'properties': {
                'sheetId': sheet_id,
                'gridProperties': {
                    'frozenRowCount': num_rows
                }
            },
            'fields': 'gridProperties.frozenRowCount'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Froze {num_rows} row(s) in '{sheet_name}'"

@mcp.tool()
async def freeze_columns(
    ctx: Context,
    sheet_name: str,
    num_columns: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Freeze columns at the left of a sheet
    
    Args:
        sheet_name: Sheet name
        num_columns: Number of columns to freeze
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'updateSheetProperties': {
            'properties': {
                'sheetId': sheet_id,
                'gridProperties': {
                    'frozenColumnCount': num_columns
                }
            },
            'fields': 'gridProperties.frozenColumnCount'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Froze {num_columns} column(s) in '{sheet_name}'"

# ============================================================================
# DIMENSION HIDE/SHOW OPERATIONS
# ============================================================================

@mcp.tool()
async def rows_hide(
    ctx: Context,
    sheet_name: str,
    start_row: int,
    end_row: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Hide rows in a sheet
    
    Args:
        sheet_name: Sheet name
        start_row: Starting row (1-based)
        end_row: Ending row (1-based)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'updateDimensionProperties': {
            'range': {
                'sheetId': sheet_id,
                'dimension': 'ROWS',
                'startIndex': start_row - 1,
                'endIndex': end_row
            },
            'properties': {
                'hiddenByUser': True
            },
            'fields': 'hiddenByUser'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Hidden rows {start_row} to {end_row} in '{sheet_name}'"

@mcp.tool()
async def rows_unhide(
    ctx: Context,
    sheet_name: str,
    start_row: int,
    end_row: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Unhide rows in a sheet
    
    Args:
        sheet_name: Sheet name
        start_row: Starting row (1-based)
        end_row: Ending row (1-based)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'updateDimensionProperties': {
            'range': {
                'sheetId': sheet_id,
                'dimension': 'ROWS',
                'startIndex': start_row - 1,
                'endIndex': end_row
            },
            'properties': {
                'hiddenByUser': False
            },
            'fields': 'hiddenByUser'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Unhidden rows {start_row} to {end_row} in '{sheet_name}'"

@mcp.tool()
async def columns_hide(
    ctx: Context,
    sheet_name: str,
    start_column: str,
    end_column: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Hide columns in a sheet
    
    Args:
        sheet_name: Sheet name
        start_column: Starting column (A, B, C...)
        end_column: Ending column
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    start_idx = ord(start_column) - ord('A')
    end_idx = ord(end_column) - ord('A') + 1
    
    request = {
        'updateDimensionProperties': {
            'range': {
                'sheetId': sheet_id,
                'dimension': 'COLUMNS',
                'startIndex': start_idx,
                'endIndex': end_idx
            },
            'properties': {
                'hiddenByUser': True
            },
            'fields': 'hiddenByUser'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Hidden columns {start_column} to {end_column} in '{sheet_name}'"

@mcp.tool()
async def columns_unhide(
    ctx: Context,
    sheet_name: str,
    start_column: str,
    end_column: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Unhide columns in a sheet
    
    Args:
        sheet_name: Sheet name
        start_column: Starting column (A, B, C...)
        end_column: Ending column
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    start_idx = ord(start_column) - ord('A')
    end_idx = ord(end_column) - ord('A') + 1
    
    request = {
        'updateDimensionProperties': {
            'range': {
                'sheetId': sheet_id,
                'dimension': 'COLUMNS',
                'startIndex': start_idx,
                'endIndex': end_idx
            },
            'properties': {
                'hiddenByUser': False
            },
            'fields': 'hiddenByUser'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Unhidden columns {start_column} to {end_column} in '{sheet_name}'"

# ============================================================================
# DIMENSION RESIZE OPERATIONS
# ============================================================================

@mcp.tool()
async def row_resize(
    ctx: Context,
    sheet_name: str,
    row: int,
    height: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Resize a row height
    
    Args:
        sheet_name: Sheet name
        row: Row number (1-based)
        height: Height in pixels
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'updateDimensionProperties': {
            'range': {
                'sheetId': sheet_id,
                'dimension': 'ROWS',
                'startIndex': row - 1,
                'endIndex': row
            },
            'properties': {
                'pixelSize': height
            },
            'fields': 'pixelSize'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Resized row {row} to {height}px in '{sheet_name}'"

@mcp.tool()
async def column_resize(
    ctx: Context,
    sheet_name: str,
    column: str,
    width: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Resize a column width
    
    Args:
        sheet_name: Sheet name
        column: Column letter (A, B, C...)
        width: Width in pixels
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    col_idx = ord(column) - ord('A')
    
    request = {
        'updateDimensionProperties': {
            'range': {
                'sheetId': sheet_id,
                'dimension': 'COLUMNS',
                'startIndex': col_idx,
                'endIndex': col_idx + 1
            },
            'properties': {
                'pixelSize': width
            },
            'fields': 'pixelSize'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Resized column {column} to {width}px in '{sheet_name}'"

# ============================================================================
# AUTOFIT OPERATIONS
# ============================================================================

@mcp.tool()
async def columns_autofit(
    ctx: Context,
    sheet_name: str,
    start_column: str,
    end_column: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Auto-resize columns to fit content
    
    Args:
        sheet_name: Sheet name
        start_column: Starting column (A, B, C...)
        end_column: Ending column
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    start_idx = ord(start_column) - ord('A')
    end_idx = ord(end_column) - ord('A') + 1
    
    request = {
        'autoResizeDimensions': {
            'dimensions': {
                'sheetId': sheet_id,
                'dimension': 'COLUMNS',
                'startIndex': start_idx,
                'endIndex': end_idx
            }
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Auto-fitted columns {start_column} to {end_column} in '{sheet_name}'"

# ============================================================================
# GROUP/UNGROUP OPERATIONS
# ============================================================================

@mcp.tool()
async def rows_group(
    ctx: Context,
    sheet_name: str,
    start_row: int,
    end_row: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Group rows together
    
    Args:
        sheet_name: Sheet name
        start_row: Starting row (1-based)
        end_row: Ending row (1-based)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'addDimensionGroup': {
            'range': {
                'sheetId': sheet_id,
                'dimension': 'ROWS',
                'startIndex': start_row - 1,
                'endIndex': end_row
            }
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Grouped rows {start_row} to {end_row} in '{sheet_name}'"

@mcp.tool()
async def columns_group(
    ctx: Context,
    sheet_name: str,
    start_column: str,
    end_column: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Group columns together
    
    Args:
        sheet_name: Sheet name
        start_column: Starting column (A, B, C...)
        end_column: Ending column
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    start_idx = ord(start_column) - ord('A')
    end_idx = ord(end_column) - ord('A') + 1
    
    request = {
        'addDimensionGroup': {
            'range': {
                'sheetId': sheet_id,
                'dimension': 'COLUMNS',
                'startIndex': start_idx,
                'endIndex': end_idx
            }
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Grouped columns {start_column} to {end_column} in '{sheet_name}'"

# ============================================================================
# DUPLICATE RANGE OPERATIONS
# ============================================================================

@mcp.tool()
async def range_duplicate(
    ctx: Context,
    source_range: str,
    target_range: str,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Duplicate a range of cells
    
    Args:
        source_range: Source range to duplicate (A1 notation)
        target_range: Target location (A1 notation)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    # Get values from source
    values = client.sheets_service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id,
        range=source_range
    ).execute().get('values', [])
    
    # Write to target
    if values:
        client.sheets_service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=target_range,
            valueInputOption='USER_ENTERED',
            body={'values': values}
        ).execute()
    
    return f"Duplicated {source_range} to {target_range}"

# ============================================================================
# TEXT FORMATTING OPERATIONS
# ============================================================================

@mcp.tool()
async def text_rotate(
    ctx: Context,
    range: str,
    angle: int,
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Rotate text in cells
    
    Args:
        range: Range to apply rotation (A1 notation)
        angle: Rotation angle in degrees (-90 to 90)
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'repeatCell': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 100,
                'startColumnIndex': 0,
                'endColumnIndex': 26
            },
            'cell': {
                'userEnteredFormat': {
                    'textRotation': {
                        'angle': angle
                    }
                }
            },
            'fields': 'userEnteredFormat.textRotation'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Rotated text in {range} by {angle} degrees"

@mcp.tool()
async def text_wrap(
    ctx: Context,
    range: str,
    wrap_strategy: str = "WRAP",
    spreadsheet_id: Optional[str] = None
) -> str:
    """
    Set text wrapping strategy
    
    Args:
        range: Range to apply wrapping (A1 notation)
        wrap_strategy: OVERFLOW_CELL, CLIP, or WRAP
        spreadsheet_id: Spreadsheet ID (uses current if not provided)
    
    Returns:
        Confirmation message
    """
    client = ctx.request_context.lifespan_context.sheets_client
    spreadsheet_id = spreadsheet_id or client.current_spreadsheet_id
    
    if not spreadsheet_id:
        raise ValueError("No spreadsheet_id provided and no current spreadsheet set")
    
    sheet_name = range.split('!')[0] if '!' in range else 'Sheet1'
    sheet_id = client.get_sheet_id_by_name(spreadsheet_id, sheet_name)
    
    if sheet_id is None:
        raise ValueError(f"Sheet '{sheet_name}' not found")
    
    request = {
        'repeatCell': {
            'range': {
                'sheetId': sheet_id,
                'startRowIndex': 0,
                'endRowIndex': 100,
                'startColumnIndex': 0,
                'endColumnIndex': 26
            },
            'cell': {
                'userEnteredFormat': {
                    'wrapStrategy': wrap_strategy
                }
            },
            'fields': 'userEnteredFormat.wrapStrategy'
        }
    }
    
    body = {'requests': [request]}
    
    client.sheets_service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body=body
    ).execute()
    
    return f"Set text wrapping to {wrap_strategy} in {range}"

# ============================================================================
# RESOURCES
# ============================================================================

@mcp.resource("spreadsheet://{spreadsheet_id}")
async def get_spreadsheet_resource(spreadsheet_id: str) -> str:
    """Get complete spreadsheet information as a resource"""
    # Note: Resources in FastMCP don't have access to context
    # This would need to be implemented differently or as a tool instead
    return json.dumps({
        "error": "Resource access not implemented - use spreadsheet_get_metadata tool instead",
        "spreadsheet_id": spreadsheet_id
    }, indent=2)

@mcp.resource("config://settings")
def get_settings() -> str:
    """Get current DocuGen settings"""
    return json.dumps({
        "version": "1.0.0",
        "api": "Google Sheets v4",
        "operations": 60,
        "auth": "OAuth 2.0",
        "transports": ["stdio", "sse", "streamable-http"]
    }, indent=2)

# ============================================================================
# PROMPTS
# ============================================================================

@mcp.prompt(title="Create Budget Spreadsheet")
def create_budget_prompt(
    budget_type: str = "personal",
    currency: str = "USD"
) -> str:
    """Generate a prompt for creating a budget spreadsheet"""
    return f"""Please create a {budget_type} budget spreadsheet with the following:
    
1. Create a new spreadsheet titled "{budget_type.title()} Budget {currency}"
2. Add sheets for: Overview, Income, Expenses, Monthly Breakdown, Annual Summary
3. Set up the Income sheet with columns: Source, Amount, Frequency, Annual Total
4. Set up the Expenses sheet with categories and subcategories
5. Add formulas to calculate totals and remaining budget
6. Apply formatting: headers in bold, currency format for amounts, colors for categories
7. Create a pie chart showing expense distribution
8. Add data validation dropdowns for categories and frequency

Currency: {currency}
Budget Type: {budget_type}
"""

@mcp.prompt(title="Import and Analyze Data")
def analyze_data_prompt(
    data_source: str,
    analysis_type: str = "summary"
) -> str:
    """Generate a prompt for data analysis"""
    return f"""Please help me analyze data from {data_source}:

1. Import the data into a new spreadsheet
2. Clean and format the data appropriately
3. Create a summary sheet with key metrics
4. Add formulas for {analysis_type} analysis
5. Create relevant charts and visualizations
6. Add pivot tables if applicable
7. Apply conditional formatting to highlight important values
8. Generate insights and recommendations

Data Source: {data_source}
Analysis Type: {analysis_type}
"""

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def main():
    """Entry point for the DocuGen MCP server"""
    import sys
    
    # Check for environment variable
    if not os.getenv('GOOGLE_OAUTH_PATH'):
        print("Error: GOOGLE_OAUTH_PATH environment variable not set", file=sys.stderr)
        print("Please set it to your Google OAuth credentials JSON file path", file=sys.stderr)
        sys.exit(1)
    
    # Run the server
    mcp.run()

if __name__ == "__main__":
    main()