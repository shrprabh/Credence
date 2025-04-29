from fastapi import FastAPI # type: ignore
from fastapi_mcp import FastApiMCP # type: ignore
from app.routers import users, skills   # import others as you add them

app = FastAPI(title="Credence API")

# Include classic REST routers
app.include_router(users.router)
app.include_router(skills.router)

# 🔗 One-liner: expose every endpoint as an MCP tool
FastApiMCP(app)        # creates /mcp/v1/… endpoints automatically :contentReference[oaicite:1]{index=1}
