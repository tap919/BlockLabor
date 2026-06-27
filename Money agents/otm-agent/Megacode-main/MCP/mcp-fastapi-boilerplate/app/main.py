from fastapi import FastAPI, Request, Header, Response
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse
from typing import Dict, Any, Optional
import asyncio
import json
import time

# ---- Minimal MCP server over HTTP+SSE (Streamable HTTP transport) ----
# Endpoints:
#   POST /mcp  -> one JSON-RPC message per POST (request or response)
#   GET  /mcp  -> Server-Sent Events channel for server-initiated messages (optional)
#
# Implements: initialize, tools/list, tools/call, resources/list, resources/read, prompts/list, prompts/get, ping

app = FastAPI(title="Overlay MCP Server (FastAPI)")
PROTOCOL_VERSION = "2025-06-18"

# Demo state
TOOLS = [
    {
        "name": "echo",
        "description": "Echo text back to you",
        "inputSchema": {
            "type": "object",
            "properties": {"text": {"type": "string"}},
            "required": ["text"]
        }
    },
    {
        "name": "sum_numbers",
        "description": "Sum a list of numbers",
        "inputSchema": {
            "type": "object",
            "properties": {"values": {"type": "array", "items": {"type": "number"}}},
            "required": ["values"]
        }
    },
    {
        "name": "bd_write_brief",
        "description": "Draft a one-paragraph BD brief for a product",
        "inputSchema": {
            "type": "object",
            "properties": {"product": {"type": "string"}, "audience": {"type": "string"}},
            "required": ["product", "audience"]
        }
    }
]

RESOURCES = {
    "overlay://welcome": {
        "uri": "overlay://welcome",
        "mimeType": "text/plain",
        "text": "Welcome to the Overlay MCP demo. Expose tools/resources/prompts here."
    }
}

PROMPTS = [
    {
        "name": "cold_email",
        "description": "Write a concise cold email for a BD intro",
        "arguments": [
            {"name": "recipient", "description": "The person to email", "required": True},
            {"name": "offer", "description": "What we're offering", "required": True}
        ],
        "messages": [
            {"role": "system", "content": "You are a concise, friendly BD assistant."},
            {"role": "user", "content": "Write a brief intro email to {{recipient}} about {{offer}}."}
        ]
    }
]

async def sse_generator():
    # Example server-initiated messages every few seconds
    while True:
        await asyncio.sleep(5)
        payload = {
            "jsonrpc": "2.0",
            "method": "notifications/message",
            "params": {"level": "info", "data": "heartbeat"}
        }
        yield {"event": "message", "data": json.dumps(payload)}


@app.get("/mcp")
async def mcp_get():
    # Open SSE channel for server-initiated messages
    return EventSourceResponse(sse_generator())


@app.post("/mcp")
async def mcp_post(request: Request, accept: Optional[str] = Header(None)):
    try:
        msg = await request.json()
    except Exception:
        return JSONResponse({"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}}, status_code=400)

    jsonrpc = msg.get("jsonrpc", "2.0")
    method = msg.get("method")
    mid = msg.get("id")

    def result(payload: Dict[str, Any]):
        return JSONResponse({"jsonrpc": jsonrpc, "id": mid, "result": payload})

    def error(code: int, message: str, data: Optional[Dict[str, Any]] = None, status: int = 400):
        body: Dict[str, Any] = {"jsonrpc": jsonrpc, "id": mid, "error": {"code": code, "message": message}}
        if data is not None:
            body["error"]["data"] = data
        return JSONResponse(body, status_code=status)

    if method == "initialize":
        server_caps = {
            "logging": {},
            "tools": {"listChanged": True},
            "resources": {"listChanged": True},
            "prompts": {"listChanged": True}
        }
        return result({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": server_caps,
            "serverInfo": {"name": "overlay.mcp", "title": "Overlay MCP Server", "version": "0.1.0"},
            "instructions": "Use tools, resources, and prompts. Handle with consent."
        })

    if method == "tools/list":
        return result({"tools": TOOLS})

    if method == "tools/call":
        params = msg.get("params", {}) or {}
        name = params.get("name") or params.get("tool")  # some clients use "name", others "tool"
        arguments = params.get("arguments") or {}
        if name == "echo":
            text = str(arguments.get("text", ""))
            return result({"content": [{"type": "text", "text": text}]})

        if name == "sum_numbers":
            values = arguments.get("values") or []
            try:
                total = float(sum(values))
            except Exception:
                return error(-32602, "Invalid params: values must be numbers")
            return result({"content": [{"type": "text", "text": str(total)}], "total": total})

        if name == "bd_write_brief":
            product = arguments.get("product", "your product")
            audience = arguments.get("audience", "your audience")
            brief = f"{product} helps {audience} achieve results faster with lower risk. Ideal for pilot, priced to start, ROI in weeks."
            return result({"content": [{"type": "text", "text": brief}]})

        return error(-32601, f"Unknown tool: {name}", status=404)

    if method == "resources/list":
        # Simple, no pagination
        return result({"resources": list(RESOURCES.values())})

    if method == "resources/read":
        params = msg.get("params", {}) or {}
        uri = params.get("uri")
        if not uri or uri not in RESOURCES:
            return error(-32602, "Invalid params: unknown or missing uri", status=404)
        res = RESOURCES[uri]
        return result({"contents": [res]})

    if method == "prompts/list":
        return result({"prompts": PROMPTS})

    if method == "prompts/get":
        params = msg.get("params", {}) or {}
        name = params.get("name")
        if not name:
            return error(-32602, "Invalid params: missing name")
        found = next((p for p in PROMPTS if p["name"] == name), None)
        if not found:
            return error(-32601, f"Unknown prompt: {name}", status=404)
        # simple substitution preview
        args = {a["name"] for a in found.get("arguments", [])}
        variables = params.get("arguments", {})
        rendered = []
        for msg_t in found["messages"]:
            content = msg_t["content"]
            for k, v in variables.items():
                content = content.replace("{{" + k + "}}", str(v))
            rendered.append({"role": msg_t["role"], "content": content})
        return result({"prompt": found, "rendered": rendered})

    if method == "ping":
        return result({})  # EmptyResult

    # Not implemented
    return error(-32601, f"Method not found: {method}", status=404)