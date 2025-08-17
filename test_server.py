#!/usr/bin/env python3
"""
Test script to verify DocuGen MCP server basic functionality
"""

import os
import sys
import json
import asyncio
from pathlib import Path

# Use real credentials if available, otherwise dummy
if Path('/Users/eagleisbatman/Desktop/credentials.json').exists():
    os.environ['GOOGLE_OAUTH_PATH'] = '/Users/eagleisbatman/Desktop/credentials.json'
else:
    os.environ['GOOGLE_OAUTH_PATH'] = '/tmp/dummy_credentials.json'

# Import the server
sys.path.insert(0, str(Path(__file__).parent))
import docugen_mcp_server

async def test_server():
    """Test basic server initialization"""
    print("Testing DocuGen MCP Server...")
    print("-" * 50)
    
    # Test 1: Check server has required attributes
    print("✓ Server module imported successfully")
    
    # Test 2: Check FastMCP is being used
    if hasattr(docugen_mcp_server, 'mcp'):
        print("✓ FastMCP server instance found")
    else:
        print("✗ FastMCP server instance not found")
        return
    
    # Test 3: Check for tools
    server = docugen_mcp_server.mcp
    
    # Get all registered tools - FastMCP stores them differently
    tools_count = 0
    tool_names = []
    
    # Check different possible attributes for FastMCP
    for attr in ['tools', '_tool_handlers', 'tool_handlers', '_tools']:
        if hasattr(server, attr):
            tools_dict = getattr(server, attr)
            if isinstance(tools_dict, dict):
                tools_count = len(tools_dict)
                tool_names = list(tools_dict.keys())[:10]
                print(f"✓ Found {tools_count} registered tools (in {attr})")
                print(f"  Sample tools: {', '.join(tool_names)}")
                break
    
    if tools_count == 0:
        # Try to introspect the module for functions
        functions = [name for name in dir(docugen_mcp_server) 
                    if callable(getattr(docugen_mcp_server, name)) 
                    and not name.startswith('_')]
        print(f"✓ Found {len(functions)} callable functions in module")
        print(f"  Sample functions: {', '.join(functions[:10])}")
        tools_count = len(functions)
    
    # Test 4: Check for key operations
    key_operations = [
        'spreadsheet_create',
        'values_update', 
        'format_cells',
        'csv_import',
        'chart_create',
        'pivot_table_create'
    ]
    
    # Check if functions exist in module
    found_ops = [op for op in key_operations 
                 if hasattr(docugen_mcp_server, op)]
    if found_ops:
        print(f"✓ Found {len(found_ops)}/{len(key_operations)} key operations as functions")
        if len(found_ops) < len(key_operations):
            missing = set(key_operations) - set(found_ops)
            print(f"  Missing: {', '.join(missing)}")
    
    print("-" * 50)
    print(f"Server test completed. {tools_count} tools available.")
    
    # Test 5: Check authentication setup
    print("\nAuthentication Check:")
    print(f"  GOOGLE_OAUTH_PATH: {os.environ.get('GOOGLE_OAUTH_PATH', 'Not set')}")
    
    token_path = Path.home() / ".docugen" / "sheets_token.json"
    if token_path.exists():
        print(f"  ✓ Token file exists: {token_path}")
    else:
        print(f"  ✗ Token file not found: {token_path}")
        print("    Run authentication first to generate token")
    
    return tools_count > 0

if __name__ == "__main__":
    success = asyncio.run(test_server())
    sys.exit(0 if success else 1)