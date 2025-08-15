#!/usr/bin/env python3
"""
Fast Document Generator - Direct Google Docs API
Bypasses MCP for speed - runs directly as a script
"""

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import json
import os
import pickle

SCOPES = ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive']

class FastDocsGenerator:
    def __init__(self, creds_path='/Users/eagleisbatman/Desktop/credentials.json'):
        self.creds = None
        self.docs_service = None
        self.drive_service = None
        self._authenticate(creds_path)
    
    def _authenticate(self, creds_path):
        token_path = os.path.expanduser('~/.docugen/token.pickle')
        
        if os.path.exists(token_path):
            with open(token_path, 'rb') as token:
                self.creds = pickle.load(token)
        
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                self.creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
                self.creds = flow.run_local_server(port=0)
            
            os.makedirs(os.path.dirname(token_path), exist_ok=True)
            with open(token_path, 'wb') as token:
                pickle.dump(self.creds, token)
        
        self.docs_service = build('docs', 'v1', credentials=self.creds)
        self.drive_service = build('drive', 'v3', credentials=self.creds)
    
    def create_report(self, title, sections):
        """
        Create a complete report in one go - FAST!
        """
        # Create document
        doc = self.docs_service.documents().create(body={'title': title}).execute()
        doc_id = doc['documentId']
        
        # Build ALL requests at once
        requests = []
        current_index = 1
        
        # Add title
        requests.append({
            'insertText': {
                'location': {'index': current_index},
                'text': f'{title}\n'
            }
        })
        requests.append({
            'updateParagraphStyle': {
                'range': {'startIndex': current_index, 'endIndex': current_index + len(title)},
                'paragraphStyle': {'namedStyleType': 'TITLE', 'alignment': 'CENTER'},
                'fields': 'namedStyleType,alignment'
            }
        })
        current_index += len(title) + 1
        
        # Add sections
        for section in sections:
            # Heading
            requests.append({
                'insertText': {
                    'location': {'index': current_index},
                    'text': f'{section["heading"]}\n'
                }
            })
            requests.append({
                'updateParagraphStyle': {
                    'range': {
                        'startIndex': current_index,
                        'endIndex': current_index + len(section["heading"])
                    },
                    'paragraphStyle': {'namedStyleType': 'HEADING_2'},
                    'fields': 'namedStyleType'
                }
            })
            current_index += len(section["heading"]) + 1
            
            # Content
            content = section["content"]
            requests.append({
                'insertText': {
                    'location': {'index': current_index},
                    'text': f'{content}\n\n'
                }
            })
            current_index += len(content) + 2
        
        # Execute ALL at once - single API call!
        requests.reverse()  # Insert in reverse order
        self.docs_service.documents().batchUpdate(
            documentId=doc_id,
            body={'requests': requests}
        ).execute()
        
        return doc_id
    
    def create_table(self, doc_id, position, headers, data):
        """
        Create a table with single batch request
        """
        rows = len(data) + 1
        cols = len(headers)
        
        requests = []
        
        # Insert table
        requests.append({
            'insertTable': {
                'location': {'index': position},
                'rows': rows,
                'columns': cols
            }
        })
        
        # Calculate all cell positions
        cell_index = position + 4
        
        # Add all content
        for header in headers:
            requests.append({
                'insertText': {
                    'location': {'index': cell_index},
                    'text': header
                }
            })
            cell_index += 3
        
        for row in data:
            for cell in row:
                requests.append({
                    'insertText': {
                        'location': {'index': cell_index},
                        'text': str(cell)
                    }
                })
                cell_index += 3
        
        # Style header row
        requests.append({
            'updateTableRowStyle': {
                'tableStartLocation': {'index': position},
                'rowIndices': [0],
                'tableRowStyle': {
                    'backgroundColor': {
                        'color': {
                            'rgbColor': {'red': 0.26, 'green': 0.52, 'blue': 0.95}
                        }
                    }
                }
            }
        })
        
        # Execute all at once
        requests.reverse()
        self.docs_service.documents().batchUpdate(
            documentId=doc_id,
            body={'requests': requests}
        ).execute()

# Example usage
if __name__ == '__main__':
    generator = FastDocsGenerator()
    
    # Create report with sections
    doc_id = generator.create_report(
        title='Q4 2024 Performance Report',
        sections=[
            {
                'heading': 'Executive Summary',
                'content': 'This quarter showed exceptional growth across all metrics.'
            },
            {
                'heading': 'Financial Performance',
                'content': 'Revenue increased by 25% year-over-year.'
            }
        ]
    )
    
    # Add a table
    generator.create_table(
        doc_id=doc_id,
        position=200,  # Approximate position
        headers=['Product', 'Q3 Sales', 'Q4 Sales'],
        data=[
            ['Widget A', '$10,000', '$12,000'],
            ['Widget B', '$8,000', '$9,500'],
            ['Widget C', '$5,000', '$7,000']
        ]
    )
    
    print(f'Document created: https://docs.google.com/document/d/{doc_id}/edit')