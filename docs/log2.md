 ✔ Container main-agent    Recreated                                                                                                                                                                                    0.4s 
Attaching to main-agent, telegram-bot
telegram-bot  | Installed 14 packages in 35ms
main-agent    | 2025-12-09 21:27:43,404 INFO agent Connecting to MCP server: https://e026aee3-487d-4b19-83aa-f466e3ae80cd-mcp-server.ai-agent.inference.cloud.ru/mcp
main-agent    | get_mcp_tools_async MCP_URLS: https://e026aee3-487d-4b19-83aa-f466e3ae80cd-mcp-server.ai-agent.inference.cloud.ru/mcp
main-agent    | MCP URLS https://e026aee3-487d-4b19-83aa-f466e3ae80cd-mcp-server.ai-agent.inference.cloud.ru/mcp
main-agent    | 2025-12-09 21:27:44,178 INFO httpx HTTP Request: POST https://e026aee3-487d-4b19-83aa-f466e3ae80cd-mcp-server.ai-agent.inference.cloud.ru/mcp "HTTP/1.1 406 Not Acceptable"
main-agent    | GOD SID FROM MCP SERVER: f51dcc4090e3494484907e852cce28af
main-agent    | 2025-12-09 21:27:44,179 INFO agent SSE not available, falling back to JSON: Expected response header Content-Type to contain 'text/event-stream', got 'application/json'
main-agent    | 2025-12-09 21:27:44,948 INFO httpx HTTP Request: POST https://e026aee3-487d-4b19-83aa-f466e3ae80cd-mcp-server.ai-agent.inference.cloud.ru/mcp "HTTP/1.1 200 OK"
telegram-bot  | 2025-12-09 21:27:45,411 - __main__ - INFO - Bot is starting...
main-agent    | GOD SID FROM MCP SERVER: f51dcc4090e3494484907e852cce28af
main-agent    | 2025-12-09 21:27:45,726 INFO httpx HTTP Request: POST https://e026aee3-487d-4b19-83aa-f466e3ae80cd-mcp-server.ai-agent.inference.cloud.ru/mcp "HTTP/1.1 406 Not Acceptable"
main-agent    | 2025-12-09 21:27:45,727 INFO agent SSE not available, falling back to JSON: Expected response header Content-Type to contain 'text/event-stream', got 'application/json'
main-agent    | 2025-12-09 21:27:46,552 INFO httpx HTTP Request: POST https://e026aee3-487d-4b19-83aa-f466e3ae80cd-mcp-server.ai-agent.inference.cloud.ru/mcp "HTTP/1.1 200 OK"
main-agent    | 2025-12-09 21:27:46,556 ERROR agent Failed to connect to MCP server https://e026aee3-487d-4b19-83aa-f466e3ae80cd-mcp-server.ai-agent.inference.cloud.ru/mcp: MCP error: {'code': -32602, 'message': 'Invalid request parameters', 'data': ''}
main-agent    | 2025-12-09 21:27:46,567 INFO __main__ Starting LangChain Agent server on port 10000
main-agent    | INFO:     Started server process [10]
main-agent    | INFO:     Waiting for application startup.
main-agent    | INFO:     Application startup complete.
main-agent    | INFO:     Uvicorn running on http://0.0.0.0:10000 (Press CTRL+C to quit)
telegram-bot  | 2025-12-09 21:27:47,033 - __main__ - WARNING - Could not send startup message to admin: Telegram server says - Bad Request: chat not found
telegram-bot  | 2025-12-09 21:27:47,033 - __main__ - INFO - Starting polling...
telegram-bot  | 2025-12-09 21:27:47,033 - aiogram.dispatcher - INFO - Start polling
telegram-bot  | 2025-12-09 21:27:47,137 - aiogram.dispatcher - INFO - Run polling for bot @test123mcp123bot id=8353110046 - 'test-mcp'
