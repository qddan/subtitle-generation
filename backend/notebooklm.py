"""
NotebookLM integration module.
Since notebooklm-mcp is an MCP server (not a CLI), we provide manual notebook ID entry
and document the workflow for users.
"""

import json
import os
from pathlib import Path


def list_notebooks() -> list:
    """
    List notebooks - returns empty list.
    Users should get notebook IDs from NotebookLM website URL.
    Example: https://notebooklm.google.com/notebook/ABC123 -> notebook_id = ABC123
    """
    return []


def add_source(notebook_id: str, filepath: str) -> dict:
    """
    Add a source file to NotebookLM.
    Since notebooklm-mcp is an MCP server, this returns instructions for manual upload.
    """
    if not os.path.exists(filepath):
        return {"error": f"File not found: {filepath}"}
    
    filename = Path(filepath).name
    
    return {
        "success": True,
        "message": f"File ready: {filename}",
        "instructions": f"To upload to NotebookLM:\n1. Open https://notebooklm.google.com/notebook/{notebook_id}\n2. Click 'Add source'\n3. Upload file: {filepath}",
        "notebook_url": f"https://notebooklm.google.com/notebook/{notebook_id}",
        "file": filepath,
    }


def get_notebook_url(notebook_id: str) -> str:
    """Get the NotebookLM URL for a notebook ID."""
    return f"https://notebooklm.google.com/notebook/{notebook_id}"
