#!/usr/bin/env python3
"""
Simple test MCP server for Megacode
This demonstrates MCP protocol over stdio
"""

import json
import sys
import time

def read_message():
    """Read a JSON-RPC message from stdin"""
    line = sys.stdin.readline()
    if not line:
        return None
    return json.loads(line.strip())

def write_message(message):
    """Write a JSON-RPC message to stdout"""
    json.dump(message, sys.stdout)
    sys.stdout.write('\n')
    sys.stdout.flush()

def handle_initialize(params):
    """Handle initialize request"""
    return {
        "jsonrpc": "2.0",
        "id": params.get("id"),
        "result": {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": "test-mcp-server",
                "version": "1.0.0"
            }
        }
    }

def handle_list_tools(params):
    """Handle listTools request"""
    return {
        "jsonrpc": "2.0",
        "id": params.get("id"),
        "result": {
            "tools": [
                {
                    "name": "create_website",
                    "description": "Create a website selling Megacode",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "theme": {
                                "type": "string",
                                "description": "Website theme (dark/light/glass)"
                            },
                            "pages": {
                                "type": "array",
                                "description": "Pages to include",
                                "items": {"type": "string"}
                            }
                        }
                    }
                },
                {
                    "name": "generate_content",
                    "description": "Generate marketing content for Megacode",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "topic": {
                                "type": "string",
                                "description": "Content topic"
                            },
                            "tone": {
                                "type": "string",
                                "description": "Writing tone"
                            }
                        }
                    }
                }
            ]
        }
    }

def handle_call_tool(params):
    """Handle callTool request"""
    tool_name = params["params"]["name"]
    args = params["params"].get("arguments", {})
    
    if tool_name == "create_website":
        result = {
            "content": [
                {
                    "type": "text",
                    "text": f"""Created Megacode sales website with:
- Theme: {args.get('theme', 'dark')}
- Pages: {', '.join(args.get('pages', ['Home', 'Features', 'Pricing', 'Contact']))}
- Features: Responsive design, MCP integration, Voice chat, Game animations
- Built using: Megacode + MCP tools
"""
                }
            ]
        }
    elif tool_name == "generate_content":
        result = {
            "content": [
                {
                    "type": "text", 
                    "text": f"""Generated content about Megacode:
Topic: {args.get('topic', 'Why Megacode is revolutionary')}
Tone: {args.get('tone', 'professional')}

Megacode is the world's first full-stack AI development system with integrated voice chat, game animation tools, and automated workflow sequencing. It transforms how developers build software by providing a unified environment with:
1. Auto-discovering MCP tool ecosystem
2. Project assessment on open
3. 8-step workflow sequence
4. Voice integration via Voicebox
5. Game/animation capabilities
"""
                }
            ]
        }
    else:
        result = {
            "content": [
                {
                    "type": "text",
                    "text": f"Unknown tool: {tool_name}"
                }
            ],
            "isError": True
        }
    
    return {
        "jsonrpc": "2.0",
        "id": params.get("id"),
        "result": result
    }

def main():
    """Main MCP server loop"""
    print("Starting test MCP server for Megacode...", file=sys.stderr)
    
    while True:
        try:
            message = read_message()
            if message is None:
                break
                
            method = message.get("method")
            
            if method == "initialize":
                response = handle_initialize(message)
                write_message(response)
            elif method == "tools/list":
                response = handle_list_tools(message)
                write_message(response)
            elif method == "tools/call":
                response = handle_call_tool(message)
                write_message(response)
            elif method == "shutdown":
                break
            else:
                # Ignore other methods
                pass
                
        except Exception as e:
            error_msg = {
                "jsonrpc": "2.0",
                "id": message.get("id") if message else None,
                "error": {
                    "code": -32603,
                    "message": str(e)
                }
            }
            write_message(error_msg)

if __name__ == "__main__":
    main()