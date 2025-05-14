from fastapi import FastAPI # type: ignore
from fastapi_mcp import FastApiMCP # type: ignore
from routers import users, skills, videos, quizzes, nft, auth

app = FastAPI(title="Credence API")

# Include classic REST routers
app.include_router(users.router)
app.include_router(skills.router)
app.include_router(videos.router)
app.include_router(quizzes.router)
app.include_router(nft.router)
app.include_router(auth.router)

# 🔗 One-liner: expose every endpoint as an MCP tool
FastApiMCP(app)  # creates /mcp/v1/… endpoints automatically
