# Complete Google Sheets API v4 Reference

## Overview
The Google Sheets API v4 provides comprehensive programmatic access to Google Sheets. This document lists EVERY available operation.

## Core Resources

### 1. Spreadsheets Resource
Main methods for spreadsheet management:
- `create` - Creates a new spreadsheet
- `get` - Returns spreadsheet metadata
- `getByDataFilter` - Returns spreadsheet filtered by criteria
- `batchUpdate` - Applies multiple updates in a single request

### 2. Spreadsheets.Values Resource
Methods for reading/writing cell values:
- `get` - Returns values from a single range
- `batchGet` - Returns values from multiple ranges
- `batchGetByDataFilter` - Returns values matching data filters
- `update` - Sets values in a single range
- `batchUpdate` - Sets values in multiple ranges
- `batchUpdateByDataFilter` - Sets values matching data filters
- `append` - Appends values to end of sheet
- `clear` - Clears values from a range
- `batchClear` - Clears multiple ranges
- `batchClearByDataFilter` - Clears ranges matching filters

### 3. Spreadsheets.Sheets Resource
- `copyTo` - Copies a sheet to another spreadsheet

### 4. Spreadsheets.DeveloperMetadata Resource
- `get` - Returns developer metadata
- `search` - Searches for metadata matching criteria

## Complete List of BatchUpdate Request Types

### Sheet Management
1. `AddSheetRequest` - Adds a new sheet
2. `DeleteSheetRequest` - Deletes a sheet
3. `DuplicateSheetRequest` - Duplicates a sheet
4. `UpdateSheetPropertiesRequest` - Updates sheet properties
5. `MoveDimensionRequest` - Moves rows/columns

### Cell and Range Operations
6. `UpdateCellsRequest` - Updates cell values and formatting
7. `AppendCellsRequest` - Appends cells after last row
8. `RepeatCellRequest` - Repeats cell values across range
9. `MergeCellsRequest` - Merges cells
10. `UnmergeCellsRequest` - Unmerges cells
11. `UpdateBordersRequest` - Updates cell borders
12. `AutoFillRequest` - Auto-fills based on existing data
13. `CutPasteRequest` - Cuts and pastes data
14. `CopyPasteRequest` - Copies and pastes data
15. `PasteDataRequest` - Pastes data with specific options
16. `FindReplaceRequest` - Finds and replaces text
17. `TextToColumnsRequest` - Splits text into columns
18. `RandomizeRangeRequest` - Randomizes order of rows

### Row and Column Operations
19. `InsertDimensionRequest` - Inserts rows/columns
20. `AppendDimensionRequest` - Appends rows/columns
21. `DeleteDimensionRequest` - Deletes rows/columns
22. `UpdateDimensionPropertiesRequest` - Updates row/column properties
23. `AutoResizeDimensionsRequest` - Auto-resizes to fit content
24. `InsertRangeRequest` - Inserts cells, shifting existing

### Sorting and Filtering
25. `SortRangeRequest` - Sorts data by columns
26. `SetBasicFilterRequest` - Sets basic filter
27. `ClearBasicFilterRequest` - Clears basic filter
28. `AddFilterViewRequest` - Adds filter view
29. `UpdateFilterViewRequest` - Updates filter view
30. `DeleteFilterViewRequest` - Deletes filter view
31. `DuplicateFilterViewRequest` - Duplicates filter view

### Data Validation
32. `SetDataValidationRequest` - Sets validation rules

### Conditional Formatting
33. `AddConditionalFormatRuleRequest` - Adds conditional format
34. `UpdateConditionalFormatRuleRequest` - Updates conditional format
35. `DeleteConditionalFormatRuleRequest` - Deletes conditional format

### Charts and Objects
36. `AddChartRequest` - Adds a chart
37. `UpdateChartSpecRequest` - Updates chart specification
38. `UpdateEmbeddedObjectPositionRequest` - Moves embedded object
39. `UpdateEmbeddedObjectBorderRequest` - Updates object border
40. `DeleteEmbeddedObjectRequest` - Deletes embedded object

### Tables
41. `AddTableRequest` - Adds a table
42. `UpdateTableRequest` - Updates table properties
43. `DeleteTableRequest` - Deletes a table

### Pivot Tables
- **Note**: Pivot tables are created using `UpdateCellsRequest` with a PivotTable object
- No dedicated pivot table requests, but full support through cell updates

### Named Ranges
44. `AddNamedRangeRequest` - Adds named range
45. `UpdateNamedRangeRequest` - Updates named range
46. `DeleteNamedRangeRequest` - Deletes named range

### Protected Ranges
47. `AddProtectedRangeRequest` - Adds protected range
48. `UpdateProtectedRangeRequest` - Updates protected range
49. `DeleteProtectedRangeRequest` - Deletes protected range

### Banding (Alternating Colors)
50. `AddBandingRequest` - Adds banded rows
51. `UpdateBandingRequest` - Updates banding
52. `DeleteBandingRequest` - Deletes banding

### Developer Metadata
53. `CreateDeveloperMetadataRequest` - Creates metadata
54. `UpdateDeveloperMetadataRequest` - Updates metadata
55. `DeleteDeveloperMetadataRequest` - Deletes metadata

### Data Sources
56. `AddDataSourceRequest` - Adds external data source
57. `UpdateDataSourceRequest` - Updates data source
58. `DeleteDataSourceRequest` - Deletes data source
59. `RefreshDataSourceRequest` - Refreshes data
60. `CancelDataSourceRefreshRequest` - Cancels refresh

### Slicers
61. `AddSlicerRequest` - Adds a slicer
62. `UpdateSlicerSpecRequest` - Updates slicer

### Spreadsheet Properties
63. `UpdateSpreadsheetPropertiesRequest` - Updates spreadsheet properties

## Value Input Options
When writing data:
- `RAW` - Values are stored as-is
- `USER_ENTERED` - Values are parsed as if typed in UI (formulas, dates, etc.)

## Value Render Options
When reading data:
- `FORMATTED_VALUE` - Values as displayed in UI
- `UNFORMATTED_VALUE` - Values without formatting
- `FORMULA` - Formula strings for formula cells

## A1 Notation
- Single cell: `A1`
- Range: `A1:B2`
- Entire column: `A:A`
- Entire row: `1:1`
- Named sheet: `Sheet1!A1:B2`
- Sheet with spaces: `'Sheet Name'!A1`

## Chart Types Supported
- AREA
- BAR
- BUBBLE
- CANDLESTICK
- COLUMN
- COMBO
- HISTOGRAM
- LINE
- ORG
- PIE
- RADAR
- SCATTER
- STEPPED_AREA
- TREEMAP
- WATERFALL

## Conditional Formatting Types
- Single color formatting
- Color scale (gradient) formatting
- Data bars
- Icon sets
- Custom formula-based

## Data Validation Types
- List from range
- List of items
- Number constraints (between, greater than, etc.)
- Text constraints (contains, equals, etc.)
- Date constraints
- Custom formula
- Checkbox

## Limits
- Maximum cells: 10 million
- Maximum columns: 18,278 (ZZZ)
- Maximum rows: No hard limit within 10M cells
- Maximum tabs: 200

## Authentication Scopes
- `https://www.googleapis.com/auth/spreadsheets` - Full access
- `https://www.googleapis.com/auth/spreadsheets.readonly` - Read only
- `https://www.googleapis.com/auth/drive` - Full Drive access
- `https://www.googleapis.com/auth/drive.file` - File-level Drive access

## Important Notes
1. All batchUpdate requests are atomic - if any fail, all fail
2. Collaborative nature means changes might be modified by other users
3. Formulas automatically adjust references when cells move
4. Pivot tables are created via UpdateCellsRequest, not dedicated requests
5. Some operations require specific OAuth scopes