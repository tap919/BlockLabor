# Overlay MCP Server (FastAPI)

A minimal **MCP server** over the **Streamable HTTP** transport (POST/GET) with SSE.
Implements:
- `initialize`
- `tools/list`, `tools/call` (echo, sum_numbers, bd_write_brief)
- `resources/list`, `resources/read` (one demo resource)
- `prompts/list`, `prompts/get` (one demo prompt)
- `ping`

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload
```

Your MCP server URL will be:

- POST: `http://localhost:8080/mcp`  
- GET (SSE): `http://localhost:8080/mcp`

## Quick test (curl)

```bash
curl -s http://localhost:8080/mcp -X POST -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {"protocolVersion": "2025-06-18"}
}'
```

```bash
curl -s http://localhost:8080/mcp -X POST -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}'
```

```bash
curl -s http://localhost:8080/mcp -X POST -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {"name": "echo", "arguments": {"text": "hello MCP"}}
}'
```

## Notes

- This is intentionally tiny and pragmatic. Wire it behind your auth / consent model.
- To add more tools, append to `TOOLS` and handle in the `tools/call` branch.
- To deploy, throw it onto your infra of choice (Fly.io, Render, EC2, etc.).